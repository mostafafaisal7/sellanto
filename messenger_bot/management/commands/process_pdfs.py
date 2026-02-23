"""
Management command to process PDFs
Usage: python manage.py process_pdfs [--all] [--pdf-id=X]
"""
# messenger_bot\management\commands\process_pdfs.py

from django.core.management.base import BaseCommand
from django.utils import timezone
from messenger_bot.models import PDFKnowledgeBase, AIConfiguration
from messenger_bot.services.rag_engine import RAGEngine
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Process PDF files for RAG knowledge base'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--all',
            action='store_true',
            help='Process all pending PDFs',
        )
        parser.add_argument(
            '--pdf-id',
            type=int,
            help='Process specific PDF by ID',
        )
        parser.add_argument(
            '--reprocess',
            action='store_true',
            help='Reprocess completed PDFs',
        )
    
    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('=' * 70))
        self.stdout.write(self.style.SUCCESS('📄 PDF PROCESSING STARTED'))
        self.stdout.write(self.style.SUCCESS('=' * 70))
        
        # Get PDFs to process
        if options['pdf_id']:
            # Process specific PDF
            pdfs = PDFKnowledgeBase.objects.filter(id=options['pdf_id'])
            if not pdfs.exists():
                self.stdout.write(self.style.ERROR(f"❌ PDF with ID {options['pdf_id']} not found"))
                return
        
        elif options['all']:
            # Process all pending or failed PDFs
            if options['reprocess']:
                pdfs = PDFKnowledgeBase.objects.all()
                self.stdout.write(self.style.WARNING('⚠️  Reprocessing ALL PDFs'))
            else:
                pdfs = PDFKnowledgeBase.objects.filter(status__in=['pending', 'failed'])
        
        else:
            # Process only pending PDFs
            pdfs = PDFKnowledgeBase.objects.filter(status='pending')
        
        if not pdfs.exists():
            self.stdout.write(self.style.WARNING('✅ No PDFs to process'))
            return
        
        self.stdout.write(f'\n📊 Found {pdfs.count()} PDF(s) to process\n')
        
        # Process each PDF
        success_count = 0
        error_count = 0
        
        for pdf in pdfs:
            self.stdout.write(f'\n{"="*70}')
            self.stdout.write(f'📄 Processing: {pdf.filename}')
            self.stdout.write(f'   ID: {pdf.id}')
            self.stdout.write(f'   Size: {pdf.file_size / 1024 / 1024:.2f} MB')
            self.stdout.write(f'   Status: {pdf.status}')
            self.stdout.write(f'{"="*70}\n')
            
            try:
                # Get AI configuration
                ai_config = pdf.connection.ai_config
                
                if not ai_config:
                    self.stdout.write(self.style.ERROR('❌ No AI configuration found'))
                    error_count += 1
                    continue
                
                # Create RAG engine
                rag_engine = RAGEngine(ai_config)
                
                # Process PDF
                self.stdout.write('⏳ Extracting text...')
                success = rag_engine.process_pdf(pdf)
                
                if success:
                    self.stdout.write(self.style.SUCCESS(f'✅ Successfully processed!'))
                    self.stdout.write(f'   📦 Created {pdf.total_chunks} chunks')
                    self.stdout.write(f'   📄 {pdf.total_pages} pages')
                    success_count += 1
                else:
                    self.stdout.write(self.style.ERROR(f'❌ Processing failed'))
                    if pdf.error_message:
                        self.stdout.write(self.style.ERROR(f'   Error: {pdf.error_message}'))
                    error_count += 1
            
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'❌ Error: {str(e)}'))
                logger.exception(f"Error processing PDF {pdf.id}")
                error_count += 1
        
        # Summary
        self.stdout.write('\n' + '=' * 70)
        self.stdout.write(self.style.SUCCESS('📊 PROCESSING SUMMARY'))
        self.stdout.write('=' * 70)
        self.stdout.write(f'✅ Successful: {success_count}')
        self.stdout.write(f'❌ Failed: {error_count}')
        self.stdout.write(f'📊 Total: {success_count + error_count}')
        self.stdout.write('=' * 70 + '\n')
        
        if success_count > 0:
            self.stdout.write(self.style.SUCCESS('🎉 PDF processing completed!'))
        elif error_count > 0:
            self.stdout.write(self.style.ERROR('⚠️  Some PDFs failed to process'))