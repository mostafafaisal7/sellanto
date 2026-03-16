# C:\Users\Trust computer\Desktop\Final_version_socialSync\messenger_bot\services\rag_engine.py

"""
RAG Engine Service
Retrieval-Augmented Generation core logic
"""
# messenger_bot\services\rag_engine.py

import logging
from typing import List, Dict, Optional
from django.db import transaction

from ..models import PDFKnowledgeBase, PDFChunk, AIConfiguration
from .pdf_processor import PDFProcessor
from .openai_client import OpenAIClient, find_most_similar

logger = logging.getLogger(__name__)


class RAGEngine:
    """
    Handles RAG (Retrieval-Augmented Generation) operations
    """
    
    def __init__(self, ai_config: AIConfiguration):
        """
        Initialize RAG engine
        
        Args:
            ai_config: AIConfiguration instance
        """
        self.ai_config = ai_config
        self.openai_client = OpenAIClient(api_key=ai_config.openai_api_key)
        self.pdf_processor = PDFProcessor(chunk_size=1000, chunk_overlap=200)
    
    def process_pdf(self, pdf_knowledge_base: PDFKnowledgeBase) -> bool:
        """
        Process a PDF and store chunks with embeddings
        
        Args:
            pdf_knowledge_base: PDFKnowledgeBase instance
            
        Returns:
            bool: Success status
        """
        try:
            # Update status
            pdf_knowledge_base.status = 'processing'
            pdf_knowledge_base.save()
            
            logger.info(f"Processing PDF: {pdf_knowledge_base.filename}")
            
            # Extract and chunk text
            chunks = self.pdf_processor.process_pdf(pdf_knowledge_base.file.path)
            
            if not chunks:
                raise ValueError("No text extracted from PDF")
            
            logger.info(f"Created {len(chunks)} chunks from PDF")
            
            # Create embeddings for all chunks
            chunk_texts = [chunk['text'] for chunk in chunks]
            embeddings = self.openai_client.create_embeddings_batch(
                chunk_texts,
                model=self.ai_config.embedding_model
            )
            
            logger.info(f"Created {len(embeddings)} embeddings")
            
            # Store chunks with embeddings in database
            with transaction.atomic():
                # Delete existing chunks if any
                PDFChunk.objects.filter(pdf=pdf_knowledge_base).delete()
                
                # Create new chunks
                pdf_chunks = []
                for chunk_data, embedding in zip(chunks, embeddings):
                    pdf_chunk = PDFChunk(
                        pdf=pdf_knowledge_base,
                        text=chunk_data['text'],
                        chunk_index=chunk_data['chunk_index'],
                        page_number=chunk_data.get('page_number'),
                    )
                    pdf_chunk.set_embedding(embedding)
                    pdf_chunks.append(pdf_chunk)
                
                # Bulk create
                PDFChunk.objects.bulk_create(pdf_chunks)
                
                # Update PDF status
                pdf_knowledge_base.status = 'completed'
                pdf_knowledge_base.total_chunks = len(chunks)
                pdf_knowledge_base.total_pages = chunks[0].get('total_pages', 0)
                pdf_knowledge_base.vectorized_at = timezone.now()
                pdf_knowledge_base.save()
            
            logger.info(f"Successfully processed PDF: {pdf_knowledge_base.filename}")
            return True
        
        except Exception as e:
            logger.error(f"Error processing PDF {pdf_knowledge_base.filename}: {e}")
            
            # Update error status
            pdf_knowledge_base.status = 'failed'
            pdf_knowledge_base.error_message = str(e)
            pdf_knowledge_base.save()
            
            return False
    
    def get_knowledge_stats(self, connection) -> Dict[str, int]:
        """Get counts of all searchable knowledge sources for a connection."""
        stats = {'pdf_chunks': 0, 'brand_dna_chunks': 0, 'product_embeddings': 0}
        try:
            stats['pdf_chunks'] = PDFChunk.objects.filter(
                pdf__connection=connection, pdf__status='completed'
            ).count()
        except Exception:
            pass
        try:
            from brands.models import BrandDNAChunk, Brand
            brand = Brand.objects.filter(user=connection.user, is_primary=True).first()
            if brand and brand.brand_dna_generated_at:
                stats['brand_dna_chunks'] = BrandDNAChunk.objects.filter(brand=brand).count()
        except Exception:
            pass
        try:
            from messenger_bot.models import ECommerceSettings, Product as EComProduct
            ecom = ECommerceSettings.objects.filter(connection=connection, is_enabled=True).first()
            if ecom:
                stats['product_embeddings'] = EComProduct.objects.filter(
                    ecommerce_settings=ecom, embedding__isnull=False
                ).exclude(embedding='').count()
        except Exception:
            pass
        return stats

    def retrieve_relevant_chunks(
        self,
        query: str,
        connection,
        top_k: Optional[int] = None,
        similarity_threshold: Optional[float] = None
    ) -> List[Dict[str, any]]:
        """
        Retrieve the most relevant chunks for a query from PDFs, Brand DNA, and products.
        Always returns top-K chunks if any exist, with a `below_threshold` flag indicating
        confidence. This ensures the LLM always gets some context from the knowledge base.

        Args:
            query: User query
            connection: MessengerConnection instance
            top_k: Number of chunks to retrieve (uses ai_config default if None)
            similarity_threshold: Confidence threshold (uses ai_config default if None)

        Returns:
            List of relevant chunks with metadata (includes `below_threshold` flag)
        """
        # Use config defaults if not specified
        if top_k is None:
            top_k = self.ai_config.top_k_results
        if similarity_threshold is None:
            similarity_threshold = self.ai_config.similarity_threshold

        logger.info(f"[RAG] Retrieving chunks for query: '{query[:80]}...' "
                     f"(top_k={top_k}, threshold={similarity_threshold})")

        # Check if OpenAI API key is set (required for embeddings)
        if not self.ai_config.openai_api_key:
            logger.error("[RAG] OpenAI API key not set — cannot create embeddings for RAG retrieval")
            return []

        # Create query embedding
        try:
            query_embedding = self.openai_client.create_embedding(
                query,
                model=self.ai_config.embedding_model
            )
        except Exception as e:
            logger.error(f"[RAG] Failed to create query embedding: {e}")
            return []

        all_chunks = []
        total_searched = 0

        # --- Search PDF chunks ---
        pdf_chunks = PDFChunk.objects.filter(
            pdf__connection=connection,
            pdf__status='completed'
        ).select_related('pdf')

        pdf_count = pdf_chunks.count()
        logger.info(f"[RAG] Searching {pdf_count} PDF chunks")

        for chunk in pdf_chunks:
            try:
                chunk_embedding = chunk.get_embedding()
                similarity = self.openai_client.cosine_similarity(query_embedding, chunk_embedding)
                total_searched += 1
                all_chunks.append({
                    'chunk': chunk,
                    'similarity': similarity,
                    'text': chunk.text,
                    'page_number': chunk.page_number,
                    'filename': chunk.pdf.filename,
                    'source_type': 'pdf',
                })
            except Exception as e:
                logger.warning(f"[RAG] Error reading PDF chunk {chunk.id}: {e}")

        # --- Search Brand DNA chunks ---
        try:
            from brands.models import BrandDNAChunk, Brand
            brand = Brand.objects.filter(
                user=connection.user, is_primary=True
            ).first()

            if brand and brand.brand_dna_generated_at:
                dna_chunks = BrandDNAChunk.objects.filter(brand=brand)
                dna_count = dna_chunks.count()
                logger.info(f"[RAG] Searching {dna_count} Brand DNA chunks")
                for chunk in dna_chunks:
                    try:
                        chunk_embedding = chunk.get_embedding()
                        similarity = self.openai_client.cosine_similarity(query_embedding, chunk_embedding)
                        total_searched += 1
                        all_chunks.append({
                            'chunk': chunk,
                            'similarity': similarity,
                            'text': chunk.text,
                            'page_title': chunk.page_title,
                            'source_url': chunk.source_url,
                            'source_type': 'brand_dna',
                        })
                    except Exception as e:
                        logger.warning(f"[RAG] Error reading DNA chunk {chunk.id}: {e}")
            else:
                logger.info("[RAG] No Brand DNA available (brand not found or DNA not generated)")
        except Exception as e:
            logger.warning(f"[RAG] Could not search Brand DNA chunks: {e}")

        # --- Search Product embeddings ---
        try:
            from messenger_bot.models import ECommerceSettings, Product as EComProduct
            ecom = ECommerceSettings.objects.filter(
                connection=connection, is_enabled=True
            ).first()

            if ecom:
                ecom_products = EComProduct.objects.filter(
                    ecommerce_settings=ecom, embedding__isnull=False
                ).exclude(embedding='')

                prod_count = ecom_products.count()
                logger.info(f"[RAG] Searching {prod_count} product embeddings")
                for product in ecom_products:
                    try:
                        prod_embedding = product.get_embedding()
                        if prod_embedding:
                            sim = self.openai_client.cosine_similarity(query_embedding, prod_embedding)
                            total_searched += 1
                            all_chunks.append({
                                'chunk': None,
                                'similarity': sim,
                                'text': (
                                    f"Product: {product.name}\n"
                                    f"Price: {ecom.currency_symbol}{product.price}\n"
                                    f"Stock: {product.stock_status}\n"
                                    f"Description: {product.short_description or product.description[:300]}\n"
                                    f"SKU: {product.sku}\n"
                                    f"Link: {product.permalink}"
                                ),
                                'source_type': 'product',
                                'product_id': product.woo_product_id,
                                'product_name': product.name,
                            })
                    except Exception as e:
                        logger.warning(f"[RAG] Error reading product embedding {product.id}: {e}")
            else:
                logger.info("[RAG] No e-commerce settings found")
        except Exception as e:
            logger.warning(f"[RAG] Could not search product embeddings: {e}")

        if not all_chunks:
            logger.warning("[RAG] Knowledge base is EMPTY — no PDF chunks, Brand DNA, or products found")
            return []

        # Sort by similarity (descending) and take top-K
        all_chunks.sort(key=lambda x: x['similarity'], reverse=True)
        top_chunks = all_chunks[:top_k]

        # Add below_threshold flag to each chunk
        for chunk_data in top_chunks:
            chunk_data['below_threshold'] = chunk_data['similarity'] < similarity_threshold

        best = top_chunks[0]['similarity'] if top_chunks else 0
        above_count = sum(1 for c in top_chunks if not c['below_threshold'])

        logger.info(
            f"[RAG] Returning {len(top_chunks)} chunks "
            f"({above_count} above threshold, searched {total_searched}, best={best:.3f})"
        )
        return top_chunks
    
    def generate_response(
        self,
        query: str,
        connection,
        conversation_history: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, any]:
        """
        Generate AI response using RAG
        
        Args:
            query: User query
            connection: MessengerConnection instance
            conversation_history: Optional conversation history
            
        Returns:
            dict: {
                'response': str,
                'context_used': str,
                'model': str,
                'tokens': int
            }
        """
        try:
            # Retrieve relevant chunks
            relevant_chunks = []
            context_text = ""
            knowledge_empty = False
            all_below_threshold = False

            if self.ai_config.rag_enabled:
                # Check if knowledge base has any data at all
                stats = self.get_knowledge_stats(connection)
                total_knowledge = sum(stats.values())
                logger.info(f"[RAG] Knowledge stats: {stats}")

                if total_knowledge == 0:
                    knowledge_empty = True
                    logger.warning("[RAG] Knowledge base is completely empty — no data to search")
                else:
                    relevant_chunks = self.retrieve_relevant_chunks(query, connection)

                if relevant_chunks:
                    # Check if all chunks are below threshold (low confidence)
                    all_below_threshold = all(c.get('below_threshold', False) for c in relevant_chunks)

                    # Build context from chunks (supports PDF, Brand DNA, and Product sources)
                    context_parts = []
                    for i, chunk_data in enumerate(relevant_chunks):
                        source_type = chunk_data.get('source_type', 'pdf')
                        if source_type == 'product':
                            source_label = (
                                f"[Source {i+1}: Product - {chunk_data.get('product_name', 'N/A')}]"
                            )
                        elif source_type == 'brand_dna':
                            source_label = (
                                f"[Source {i+1}: Brand Website - {chunk_data.get('page_title', 'N/A')}, "
                                f"URL: {chunk_data.get('source_url', 'N/A')}]"
                            )
                        else:
                            source_label = (
                                f"[Source {i+1}: {chunk_data.get('filename', 'Document')}, "
                                f"Page {chunk_data.get('page_number') or 'N/A'}]"
                            )
                        context_parts.append(f"{source_label}\n{chunk_data['text']}\n")
                    context_text = "\n".join(context_parts)
                    logger.info(f"[RAG] Using {len(relevant_chunks)} chunks as context "
                                f"(all_below_threshold={all_below_threshold})")
            
            # Get active prompt
            active_prompt = connection.prompts.filter(is_active=True).first()
            base_system_prompt = active_prompt.system_prompt if active_prompt else (
                "You are a helpful AI assistant."
            )
            
            # Enhanced system prompt with language detection and formatting rules
            system_prompt = f"""{base_system_prompt}

<critical_rules>
1. LANGUAGE MATCHING (highest priority):
   - Detect the language of EACH user message independently.
   - ALWAYS respond in the SAME language as the user's message.
   - Bengali (বাংলা) → respond entirely in Bengali
   - English → respond entirely in English
   - Mixed language → match the dominant language
   - Any other language → respond in that language
   - NEVER switch languages unless the user does first.

2. FORMATTING FOR MESSAGING APPS:
   - Do NOT use any markdown: no **bold**, no *italic*, no ### headers, no `code`
   - Do NOT use bullet points with - or * symbols
   - Write in natural, conversational sentences and short paragraphs
   - Use line breaks between paragraphs for readability
   - Use emoji sparingly (1-2 max) only if it matches the brand tone

3. RESPONSE QUALITY:
   - Be helpful, friendly, and direct — this is a chat, not an essay
   - Give complete answers — don't make the customer ask follow-up questions
     for basic information
   - When sharing product info, ALWAYS include: name, price, availability,
     and purchase link (if available)
   - If you don't have enough information to answer, say so clearly and
     offer to connect them with a human

4. KNOWLEDGE BOUNDARIES:
   - Answer using ONLY the provided knowledge context and product catalog
   - If the answer is not in your knowledge base, say "I don't have that
     specific information right now" — do NOT make up answers
   - Never hallucinate product details, prices, or availability
</critical_rules>"""

            # Add e-commerce context if products exist
            try:
                from messenger_bot.models import ECommerceSettings as EComSettings
                ecom = EComSettings.objects.filter(
                    connection=connection, is_enabled=True
                ).first()
                if ecom and ecom.products.exists():
                    product_count = ecom.products.count()
                    system_prompt += (
                        f"\n\nYou have access to a product catalog with {product_count} products. "
                        f"When users ask about products, search the knowledge base for matching items "
                        f"and provide: product name, price in {ecom.currency_symbol}, stock availability, "
                        f"and direct purchase link. If multiple products match, present the top 3 most relevant options."
                    )
            except Exception:
                pass

            # Build messages
            messages = [{"role": "system", "content": system_prompt}]
            
            # Add conversation history if provided
            if conversation_history:
                messages.extend(conversation_history[-10:])  # Last 10 messages
            
            # Add context and query
            if context_text and not all_below_threshold:
                # High confidence — chunks matched well
                user_message = (
                    f"<knowledge_context>\n{context_text}\n</knowledge_context>\n\n"
                    f"<customer_question>\n{query}\n</customer_question>\n\n"
                    f"Answer the customer's question using ONLY the knowledge context above.\n"
                    f"If the context doesn't contain the answer, say so honestly."
                )
            elif context_text and all_below_threshold:
                # Low confidence — chunks exist but are not a strong match.
                # Still provide them so the LLM has SOMETHING to work with.
                user_message = (
                    f"<knowledge_context>\n{context_text}\n</knowledge_context>\n\n"
                    f"<customer_question>\n{query}\n</customer_question>\n\n"
                    f"The knowledge context above is from our documents and may contain "
                    f"relevant information. Use it to answer the customer's question if applicable. "
                    f"If the context doesn't help answer the question, say so honestly."
                )
                logger.info("[RAG] Using low-confidence context prompt")
            elif knowledge_empty:
                # Knowledge base is completely empty
                user_message = (
                    f"<customer_question>\n{query}\n</customer_question>\n\n"
                    f"IMPORTANT: Your knowledge base has not been set up yet. "
                    f"You have no product information, documents, or brand details to reference. "
                    f"Greet the customer warmly, let them know you're still being set up, "
                    f"and offer to connect them with a human team member for assistance."
                )
                logger.info("[RAG] Sending empty-knowledge prompt to LLM")
            else:
                user_message = query
            
            messages.append({"role": "user", "content": user_message})
            
            # Generate response
            response = self.openai_client.chat_completion(
                messages=messages,
                model=self.ai_config.openai_model,
                temperature=self.ai_config.temperature,
                max_tokens=self.ai_config.max_tokens
            )
            
            # Clean any remaining markdown from response
            clean_response = self._clean_markdown(response['content'])
            
            return {
                'response': clean_response,
                'context_used': context_text,
                'model': response['model'],
                'tokens': response['tokens'],
                'chunks_used': len(relevant_chunks)
            }
        
        except Exception as e:
            logger.error(f"Error generating response: {e}")
            return {
                'response': "I'm sorry, I encountered an error while processing your request.",
                'context_used': "",
                'model': self.ai_config.openai_model,
                'tokens': 0,
                'chunks_used': 0,
                'error': str(e)
            }
    
    def _clean_markdown(self, text: str) -> str:
        """Remove markdown formatting from text"""
        import re
        
        # Remove bold **text** or __text__
        text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
        text = re.sub(r'__(.+?)__', r'\1', text)
        
        # Remove italic *text* or _text_
        text = re.sub(r'\*(.+?)\*', r'\1', text)
        text = re.sub(r'(?<!\w)_(.+?)_(?!\w)', r'\1', text)
        
        # Remove headers ### text
        text = re.sub(r'^#{1,6}\s*', '', text, flags=re.MULTILINE)
        
        # Remove bullet points - or *
        text = re.sub(r'^\s*[-*]\s+', '', text, flags=re.MULTILINE)
        
        # Remove numbered lists 1. 2. etc
        text = re.sub(r'^\s*\d+\.\s+', '', text, flags=re.MULTILINE)
        
        # Remove code blocks ```
        text = re.sub(r'```[\s\S]*?```', '', text)
        
        # Remove inline code `text`
        text = re.sub(r'`(.+?)`', r'\1', text)
        
        # Clean extra whitespace
        text = re.sub(r'\n{3,}', '\n\n', text)
        
        return text.strip()


# Import timezone for the vectorized_at field
from django.utils import timezone