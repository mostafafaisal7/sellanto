# messenger_bot/signals.py

"""
Django signals for automatic PDF processing
"""

import logging
from django.db.models.signals import post_save
from django.dispatch import receiver
from threading import Thread
from .models import PDFKnowledgeBase
from .services.pdf_processor import PDFProcessor
from .services.openai_client import OpenAIClient

logger = logging.getLogger(__name__)


def process_pdf_background(pdf_id):
    """
    Process PDF in background thread

    Args:
        pdf_id: PDFKnowledgeBase ID
    """
    try:
        # Get PDF object
        pdf = PDFKnowledgeBase.objects.get(id=pdf_id)

        # Skip if already processed
        if pdf.status == 'completed':
            logger.info(f"PDF {pdf.filename} already processed")
            return

        # Update status to processing
        pdf.status = 'processing'
        pdf.save()

        logger.info(f"[PDF] Auto-processing PDF: {pdf.filename}")

        # Get AI configuration
        connection = pdf.connection
        try:
            ai_config = connection.ai_config
        except Exception:
            logger.error("No AI configuration found")
            pdf.status = 'failed'
            pdf.error_message = "AI configuration not found"
            pdf.save()
            return

        # Initialize processors
        pdf_processor = PDFProcessor()
        openai_client = OpenAIClient(ai_config.openai_api_key)

        # Extract text
        logger.info(f"[PDF] Extracting text from {pdf.filename}")
        text = pdf_processor.extract_text_from_pdf(pdf.file.path)

        if not text:
            logger.error(f"Failed to extract text from {pdf.filename}")
            pdf.status = 'failed'
            pdf.error_message = "Failed to extract text"
            pdf.save()
            return

        # Create chunks
        logger.info(f"[PDF] Creating chunks for {pdf.filename}")
        chunks = pdf_processor.create_chunks(
            text,
            chunk_size=1000,
            overlap=200
        )

        logger.info(f"Created {len(chunks)} chunks")

        # Generate embeddings for each chunk
        logger.info(f"[PDF] Generating embeddings for {pdf.filename}")

        from .models import PDFChunk
        created_chunks = 0

        for i, chunk_text in enumerate(chunks):
            try:
                # Generate embedding
                embedding = openai_client.create_embedding(
                    chunk_text,
                    model=ai_config.embedding_model
                )

                # Save chunk with embedding
                chunk_obj = PDFChunk(
                    pdf=pdf,
                    text=chunk_text,
                    chunk_index=i
                )
                chunk_obj.set_embedding(embedding)
                chunk_obj.save()
                created_chunks += 1

                if (i + 1) % 10 == 0:
                    logger.info(f"Processed {i + 1}/{len(chunks)} chunks")

            except Exception as e:
                logger.error(f"Error processing chunk {i}: {e}")

        # Update PDF status
        pdf.total_chunks = created_chunks
        pdf.status = 'completed'
        pdf.save()

        logger.info(f"[PDF] Successfully processed {pdf.filename}: {created_chunks} chunks created")

    except PDFKnowledgeBase.DoesNotExist:
        logger.error(f"PDF with id {pdf_id} not found")

    except Exception as e:
        logger.error(f"Error auto-processing PDF {pdf_id}: {e}")
        try:
            pdf = PDFKnowledgeBase.objects.get(id=pdf_id)
            pdf.status = 'failed'
            pdf.error_message = str(e)
            pdf.save()
        except Exception:
            pass


@receiver(post_save, sender=PDFKnowledgeBase)
def auto_process_pdf(sender, instance, created, **kwargs):
    """
    Automatically process PDF when:
    1. New PDF uploaded with pending status
    2. Existing PDF status is pending and no chunks exist
    """
    try:
        logger.info(f"[SIGNAL] PDF post_save: {instance.filename}, status={instance.status}, created={created}")

        # Only process PDFs with pending status
        if instance.status != 'pending':
            return

        # Check if already has chunks (already processed)
        from .models import PDFChunk
        chunk_count = PDFChunk.objects.filter(pdf=instance).count()

        if chunk_count > 0:
            logger.info(f"PDF {instance.filename} already has {chunk_count} chunks, skipping")
            return

        logger.info(f"[SIGNAL] Starting background processing for: {instance.filename}")

        # Start processing in background thread (daemon=False so it survives on cPanel/Passenger)
        thread = Thread(target=process_pdf_background, args=(instance.id,))
        thread.daemon = False
        thread.start()

        logger.info(f"[SIGNAL] Background thread started for {instance.filename}")

    except Exception as e:
        # Never let signal errors crash the save operation
        logger.error(f"[SIGNAL] Error in auto_process_pdf: {e}")
