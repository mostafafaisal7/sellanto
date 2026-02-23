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
    
    def retrieve_relevant_chunks(
        self,
        query: str,
        connection,
        top_k: Optional[int] = None,
        similarity_threshold: Optional[float] = None
    ) -> List[Dict[str, any]]:
        """
        Retrieve relevant chunks for a query from both PDFs and Brand DNA.

        Args:
            query: User query
            connection: MessengerConnection instance
            top_k: Number of chunks to retrieve (uses ai_config default if None)
            similarity_threshold: Minimum similarity score (uses ai_config default if None)

        Returns:
            List of relevant chunks with metadata
        """
        try:
            # Use config defaults if not specified
            if top_k is None:
                top_k = self.ai_config.top_k_results
            if similarity_threshold is None:
                similarity_threshold = self.ai_config.similarity_threshold

            logger.info(f"Retrieving chunks for query (top_k={top_k}, threshold={similarity_threshold})")

            # Create query embedding
            query_embedding = self.openai_client.create_embedding(
                query,
                model=self.ai_config.embedding_model
            )

            chunks_data = []

            # --- Search PDF chunks ---
            pdf_chunks = PDFChunk.objects.filter(
                pdf__connection=connection,
                pdf__status='completed'
            ).select_related('pdf')

            for chunk in pdf_chunks:
                chunk_embedding = chunk.get_embedding()
                similarity = self.openai_client.cosine_similarity(query_embedding, chunk_embedding)

                if similarity >= similarity_threshold:
                    chunks_data.append({
                        'chunk': chunk,
                        'similarity': similarity,
                        'text': chunk.text,
                        'page_number': chunk.page_number,
                        'filename': chunk.pdf.filename,
                        'source_type': 'pdf',
                    })

            # --- Search Brand DNA chunks ---
            try:
                from brands.models import BrandDNAChunk, Brand
                brand = Brand.objects.filter(
                    user=connection.user, is_primary=True
                ).first()

                if brand and brand.brand_dna_generated_at:
                    dna_chunks = BrandDNAChunk.objects.filter(brand=brand)
                    for chunk in dna_chunks:
                        chunk_embedding = chunk.get_embedding()
                        similarity = self.openai_client.cosine_similarity(query_embedding, chunk_embedding)

                        if similarity >= similarity_threshold:
                            chunks_data.append({
                                'chunk': chunk,
                                'similarity': similarity,
                                'text': chunk.text,
                                'page_title': chunk.page_title,
                                'source_url': chunk.source_url,
                                'source_type': 'brand_dna',
                            })
                    logger.info(f"Searched {dna_chunks.count()} Brand DNA chunks")
            except Exception as e:
                logger.warning(f"Could not search Brand DNA chunks: {e}")

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

                    product_threshold = ecom.product_match_threshold or 0.35
                    for product in ecom_products:
                        prod_embedding = product.get_embedding()
                        if prod_embedding:
                            sim = self.openai_client.cosine_similarity(query_embedding, prod_embedding)
                            if sim >= product_threshold:
                                chunks_data.append({
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

                    logger.info(f"Searched {ecom_products.count()} product embeddings")
            except Exception as e:
                logger.warning(f"Could not search product embeddings: {e}")

            if not chunks_data:
                logger.warning("No relevant chunks found from any source")
                return []

            # Sort combined results by similarity
            chunks_data.sort(key=lambda x: x['similarity'], reverse=True)

            # Return top k
            relevant_chunks = chunks_data[:top_k]

            logger.info(f"Retrieved {len(relevant_chunks)} relevant chunks")
            return relevant_chunks

        except Exception as e:
            logger.error(f"Error retrieving chunks: {e}")
            return []
    
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
            
            if self.ai_config.rag_enabled:
                relevant_chunks = self.retrieve_relevant_chunks(query, connection)
                
                if relevant_chunks:
                    # Build context from chunks (supports both PDF and Brand DNA sources)
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
                    logger.info(f"Using {len(relevant_chunks)} chunks as context")
            
            # Get active prompt
            active_prompt = connection.prompts.filter(is_active=True).first()
            base_system_prompt = active_prompt.system_prompt if active_prompt else (
                "You are a helpful AI assistant."
            )
            
            # Enhanced system prompt with language detection and formatting rules
            system_prompt = f"""{base_system_prompt}

IMPORTANT RULES:
1. LANGUAGE: Detect the language of the user's message and ALWAYS respond in the SAME language. 
   - If user writes in Bengali (বাংলা), respond in Bengali
   - If user writes in English, respond in English
   - If user writes in any other language, respond in that language
   - If user mixes languages, respond in the dominant language

2. FORMATTING: 
   - Do NOT use markdown formatting like **bold**, *italic*, ### headers
   - Do NOT use bullet points with - or *
   - Write in natural, conversational paragraphs
   - Keep responses clean and readable for messaging apps

3. RESPONSE STYLE:
   - Be helpful and friendly
   - Give complete answers, don't cut off mid-sentence
   - Be concise but thorough
   - When sharing product info, include the price, availability, and link if available"""

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
                        f"When users ask about products, use the product information from the knowledge base "
                        f"to provide accurate answers including prices (in {ecom.currency_symbol}), "
                        f"availability, and direct links. If a user wants to order, provide the product link."
                    )
            except Exception:
                pass

            # Build messages
            messages = [{"role": "system", "content": system_prompt}]
            
            # Add conversation history if provided
            if conversation_history:
                messages.extend(conversation_history[-10:])  # Last 10 messages
            
            # Add context and query
            if context_text:
                user_message = (
                    f"Based on the following information:\n\n{context_text}\n\n"
                    f"Please answer this question: {query}"
                )
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