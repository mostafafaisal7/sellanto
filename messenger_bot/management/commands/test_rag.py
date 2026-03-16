"""
Management command to diagnose RAG retrieval issues.

Usage:
    python manage.py test_rag --page-id=<PAGE_ID> --query="Tell me about your products"
    python manage.py test_rag --page-id=<PAGE_ID>   (uses default test query)
"""

from django.core.management.base import BaseCommand

from messenger_bot.models import (
    MessengerConnection, AIConfiguration, PDFKnowledgeBase, PDFChunk,
)


class Command(BaseCommand):
    help = 'Diagnose RAG retrieval for a messenger bot connection'

    def add_arguments(self, parser):
        parser.add_argument('--page-id', type=str, help='Facebook page ID')
        parser.add_argument('--connection-id', type=int, help='MessengerConnection ID (alternative to page-id)')
        parser.add_argument('--query', type=str, default='Tell me about your products and services',
                            help='Test query to run against knowledge base')
        parser.add_argument('--threshold', type=float, default=None,
                            help='Override similarity threshold for testing')

    def handle(self, *args, **options):
        # Find connection
        connection = None
        if options['page_id']:
            try:
                connection = MessengerConnection.objects.get(page_id=options['page_id'])
            except MessengerConnection.DoesNotExist:
                self.stderr.write(self.style.ERROR(f"No connection found for page_id={options['page_id']}"))
                return
        elif options['connection_id']:
            try:
                connection = MessengerConnection.objects.get(id=options['connection_id'])
            except MessengerConnection.DoesNotExist:
                self.stderr.write(self.style.ERROR(f"No connection found for id={options['connection_id']}"))
                return
        else:
            connections = MessengerConnection.objects.all()
            if connections.count() == 0:
                self.stderr.write(self.style.ERROR("No messenger connections found"))
                return
            elif connections.count() == 1:
                connection = connections.first()
                self.stdout.write(f"Using only connection: {connection.page_name}")
            else:
                self.stderr.write(self.style.ERROR(
                    "Multiple connections found. Specify --page-id or --connection-id:\n" +
                    "\n".join(f"  ID={c.id}, page_id={c.page_id}, name={c.page_name}" for c in connections)
                ))
                return

        self.stdout.write(self.style.SUCCESS(f"\n=== RAG Diagnostic for: {connection.page_name} ==="))
        self.stdout.write(f"Connection ID: {connection.id}")
        self.stdout.write(f"Page ID: {connection.page_id}")
        self.stdout.write(f"User: {connection.user}")

        # Check AI Config
        ai_config = getattr(connection, 'ai_config', None)
        if not ai_config:
            self.stderr.write(self.style.ERROR("\nAI Configuration: NOT FOUND"))
            self.stderr.write("Fix: Create AIConfiguration for this connection in Django admin")
            return

        self.stdout.write(self.style.SUCCESS("\n--- AI Configuration ---"))
        self.stdout.write(f"RAG Enabled: {ai_config.rag_enabled}")
        self.stdout.write(f"OpenAI API Key: {'SET' if ai_config.openai_api_key else 'NOT SET'}")
        self.stdout.write(f"Embedding Model: {ai_config.embedding_model}")
        self.stdout.write(f"Similarity Threshold: {ai_config.similarity_threshold}")
        self.stdout.write(f"Top K Results: {ai_config.top_k_results}")
        self.stdout.write(f"LLM Model: {ai_config.openai_model}")

        if not ai_config.rag_enabled:
            self.stderr.write(self.style.WARNING("\nRAG is DISABLED. Enable it in AI Configuration."))

        if not ai_config.openai_api_key:
            self.stderr.write(self.style.ERROR("\nOpenAI API key is NOT SET. Embeddings cannot be created."))
            self.stderr.write("Fix: Set openai_api_key in AIConfiguration")
            return

        # Check knowledge sources
        self.stdout.write(self.style.SUCCESS("\n--- Knowledge Sources ---"))

        # PDFs
        pdfs = PDFKnowledgeBase.objects.filter(connection=connection)
        self.stdout.write(f"\nPDFs: {pdfs.count()}")
        for pdf in pdfs:
            chunk_count = PDFChunk.objects.filter(pdf=pdf).count()
            status_style = self.style.SUCCESS if pdf.status == 'completed' else self.style.ERROR
            self.stdout.write(f"  [{status_style(pdf.status)}] {pdf.filename} — {chunk_count} chunks")
            if pdf.error_message:
                self.stdout.write(f"    Error: {pdf.error_message}")

        total_pdf_chunks = PDFChunk.objects.filter(
            pdf__connection=connection, pdf__status='completed'
        ).count()
        self.stdout.write(f"  Total searchable PDF chunks: {total_pdf_chunks}")

        # Brand DNA
        try:
            from brands.models import BrandDNAChunk, Brand
            brand = Brand.objects.filter(user=connection.user, is_primary=True).first()
            if brand:
                if brand.brand_dna_generated_at:
                    dna_count = BrandDNAChunk.objects.filter(brand=brand).count()
                    self.stdout.write(f"\nBrand DNA: {dna_count} chunks (brand: {brand.brand_name})")
                else:
                    self.stdout.write(self.style.WARNING(f"\nBrand DNA: NOT GENERATED (brand: {brand.brand_name})"))
                    self.stdout.write("  Fix: Generate Brand DNA from Strategy Hub")
            else:
                self.stdout.write(self.style.WARNING("\nBrand DNA: No primary brand found"))
        except Exception as e:
            self.stdout.write(f"\nBrand DNA: Error — {e}")

        # Products
        try:
            from messenger_bot.models import ECommerceSettings, Product as EComProduct
            ecom = ECommerceSettings.objects.filter(connection=connection, is_enabled=True).first()
            if ecom:
                prod_total = ecom.products.count()
                prod_embedded = EComProduct.objects.filter(
                    ecommerce_settings=ecom, embedding__isnull=False
                ).exclude(embedding='').count()
                self.stdout.write(f"\nProducts: {prod_embedded}/{prod_total} with embeddings")
            else:
                self.stdout.write("\nProducts: No e-commerce configured")
        except Exception as e:
            self.stdout.write(f"\nProducts: Error — {e}")

        # Test embedding creation
        self.stdout.write(self.style.SUCCESS("\n--- Embedding Test ---"))
        try:
            from messenger_bot.services.openai_client import OpenAIClient
            client = OpenAIClient(ai_config.openai_api_key)
            test_embedding = client.create_embedding('test query', model=ai_config.embedding_model)
            self.stdout.write(self.style.SUCCESS(f"Embedding creation: OK ({len(test_embedding)} dimensions)"))
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Embedding creation: FAILED — {e}"))
            self.stderr.write("Fix: Check OpenAI API key and billing status")
            return

        # Test retrieval
        query = options['query']
        threshold = options['threshold'] or ai_config.similarity_threshold
        self.stdout.write(self.style.SUCCESS(f"\n--- Retrieval Test ---"))
        self.stdout.write(f"Query: \"{query}\"")
        self.stdout.write(f"Threshold: {threshold}")

        try:
            from messenger_bot.services.rag_engine import RAGEngine
            rag = RAGEngine(ai_config)

            query_embedding = client.create_embedding(query, model=ai_config.embedding_model)

            # Test against all PDF chunks (show top 5 regardless of threshold)
            all_scores = []
            pdf_chunks = PDFChunk.objects.filter(
                pdf__connection=connection, pdf__status='completed'
            ).select_related('pdf')

            for chunk in pdf_chunks:
                try:
                    chunk_emb = chunk.get_embedding()
                    sim = client.cosine_similarity(query_embedding, chunk_emb)
                    all_scores.append((sim, chunk.text[:100], chunk.pdf.filename, 'pdf'))
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f"  Chunk {chunk.id} error: {e}"))

            # Brand DNA chunks
            try:
                from brands.models import BrandDNAChunk, Brand
                brand = Brand.objects.filter(user=connection.user, is_primary=True).first()
                if brand and brand.brand_dna_generated_at:
                    for chunk in BrandDNAChunk.objects.filter(brand=brand):
                        try:
                            chunk_emb = chunk.get_embedding()
                            sim = client.cosine_similarity(query_embedding, chunk_emb)
                            all_scores.append((sim, chunk.text[:100], chunk.page_title or 'Brand DNA', 'brand_dna'))
                        except Exception:
                            pass
            except Exception:
                pass

            all_scores.sort(key=lambda x: x[0], reverse=True)

            if not all_scores:
                self.stderr.write(self.style.ERROR("\nNo chunks found in knowledge base at all!"))
                self.stderr.write("Fix: Upload PDFs or generate Brand DNA")
            else:
                self.stdout.write(f"\nTop 5 matches (showing all, threshold={threshold}):")
                for i, (sim, text, source, stype) in enumerate(all_scores[:5]):
                    status = self.style.SUCCESS("PASS") if sim >= threshold else self.style.ERROR("BELOW")
                    self.stdout.write(f"  {i+1}. [{status}] sim={sim:.4f} [{stype}:{source}]")
                    self.stdout.write(f"     {text}...")

                above = [s for s in all_scores if s[0] >= threshold]
                self.stdout.write(f"\nChunks above threshold: {len(above)}/{len(all_scores)}")

                if len(above) == 0:
                    self.stderr.write(self.style.WARNING(
                        f"\nAll chunks scored below threshold ({threshold}). "
                        f"Best score: {all_scores[0][0]:.4f}. "
                        f"Try lowering threshold: python manage.py test_rag --threshold=0.2 ..."
                    ))

        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Retrieval test failed: {e}"))

        self.stdout.write(self.style.SUCCESS("\n=== Diagnostic Complete ==="))
