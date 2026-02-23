# C:\Users\Trust computer\Desktop\Final_version_socialSync\messenger_bot\services\pdf_processor.py

"""
PDF Processor Service
Extracts text from PDFs and chunks it for RAG
"""

import PyPDF2
import logging
from typing import List, Dict
import re

logger = logging.getLogger(__name__)


class PDFProcessor:
    """
    Handles PDF text extraction and intelligent chunking
    """
    
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200):
        """
        Initialize PDF processor
        
        Args:
            chunk_size: Maximum characters per chunk
            chunk_overlap: Number of overlapping characters between chunks
        """
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
    
    def extract_text_from_pdf(self, pdf_path: str) -> str:
        """
        Extract text from PDF file
        
        Args:
            pdf_path: Path to PDF file
            
        Returns:
            str: Extracted text
        """
        try:
            text = ""
            
            with open(pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                total_pages = len(pdf_reader.pages)
                
                logger.info(f"Processing {total_pages} pages from PDF")
                
                # Extract text from all pages
                for page_num, page in enumerate(pdf_reader.pages):
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
                
                logger.info(f"Extracted {len(text)} characters from PDF")
            
            return text.strip()
        
        except Exception as e:
            logger.error(f"Error extracting text from PDF: {e}")
            raise
    
    def clean_text(self, text: str) -> str:
        """
        Clean extracted text
        
        Args:
            text: Raw extracted text
            
        Returns:
            str: Cleaned text
        """
        # Remove excessive whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Remove special characters but keep basic punctuation
        text = re.sub(r'[^\w\s.,!?;:\-\(\)\[\]\'\"]+', '', text)
        
        return text.strip()
        
    def create_chunks(self, text: str, chunk_size: int = None, overlap: int = None) -> List[str]:
            """
            Split text into overlapping chunks (simple version)
            
            Args:
                text: Full text to split
                chunk_size: Size of each chunk in characters (uses instance default if None)
                overlap: Number of characters to overlap between chunks (uses instance default if None)
                
            Returns:
                List of text chunks (strings only)
            """
            if not text:
                return []
            
            # Use provided values or instance defaults
            chunk_size = chunk_size or self.chunk_size
            overlap = overlap or self.chunk_overlap
            
            # Clean text first
            text = self.clean_text(text)
            
            chunks = []
            start = 0
            text_length = len(text)
            
            # Safety counter to prevent infinite loops
            max_iterations = text_length + 100
            iteration = 0
            
            while start < text_length and iteration < max_iterations:
                iteration += 1
                
                # Calculate end position
                end = start + chunk_size
                
                # If we've gone past the text, take what's left
                if end > text_length:
                    end = text_length
                
                # If not at the end, try to break at sentence boundary
                if end < text_length:
                    # Look for sentence endings (., !, ?)
                    last_period = text.rfind('.', start, end)
                    last_question = text.rfind('?', start, end)
                    last_exclamation = text.rfind('!', start, end)
                    
                    # Use the latest sentence ending
                    sentence_end = max(last_period, last_question, last_exclamation)
                    
                    if sentence_end > start:
                        end = sentence_end + 1
                
                # Extract chunk
                chunk_text = text[start:end].strip()
                
                if chunk_text:
                    chunks.append(chunk_text)
                
                # Calculate next start with overlap
                next_start = end - overlap
                
                # CRITICAL: Ensure we're always moving forward
                if next_start <= start:
                    # If overlap would keep us in same place, move forward by at least 1 char
                    next_start = start + max(1, chunk_size // 2)
                
                start = next_start
                
                # If we've reached or passed the end, stop
                if start >= text_length:
                    break
            
            logger.info(f"Created {len(chunks)} chunks from text (iterations: {iteration})")
            return chunks

    def chunk_text(self, text: str, page_number: int = None) -> List[Dict[str, any]]:
        """
        Split text into overlapping chunks with metadata
        
        Args:
            text: Text to chunk
            page_number: Optional page number
            
        Returns:
            List of chunks with metadata
        """
        # Clean text first
        text = self.clean_text(text)
        
        chunks = []
        start = 0
        chunk_index = 0
        
        while start < len(text):
            # Calculate end position
            end = start + self.chunk_size
            
            # If not at the end, try to break at sentence boundary
            if end < len(text):
                # Look for sentence endings (., !, ?)
                last_period = text.rfind('.', start, end)
                last_question = text.rfind('?', start, end)
                last_exclamation = text.rfind('!', start, end)
                
                # Use the latest sentence ending
                sentence_end = max(last_period, last_question, last_exclamation)
                
                if sentence_end > start:
                    end = sentence_end + 1
            
            # Extract chunk
            chunk_text = text[start:end].strip()
            
            if chunk_text:
                chunks.append({
                    'text': chunk_text,
                    'chunk_index': chunk_index,
                    'page_number': page_number,
                    'start_char': start,
                    'end_char': end,
                    'length': len(chunk_text)
                })
                
                chunk_index += 1
            
            # Move start position with overlap
            start = end - self.chunk_overlap
        
        logger.info(f"Created {len(chunks)} chunks from text")
        return chunks
    
    def process_pdf(self, pdf_path: str) -> List[Dict[str, any]]:
        """
        Complete PDF processing pipeline
        
        Args:
            pdf_path: Path to PDF file
            
        Returns:
            List of processed chunks with metadata
        """
        try:
            # Extract text
            text = self.extract_text_from_pdf(pdf_path)
            
            if not text:
                raise ValueError("No text extracted from PDF")
            
            # Chunk text with metadata
            chunks = self.chunk_text(text)
            
            logger.info(f"Successfully processed PDF: {len(chunks)} chunks created")
            return chunks
        
        except Exception as e:
            logger.error(f"Error processing PDF: {e}")
            raise


# Utility function for quick processing
def process_pdf_file(pdf_path: str, chunk_size: int = 1000) -> List[str]:
    """
    Quick utility to process a PDF file
    
    Args:
        pdf_path: Path to PDF file
        chunk_size: Size of each chunk
        
    Returns:
        List of text chunks (strings)
    """
    processor = PDFProcessor(chunk_size=chunk_size)
    text = processor.extract_text_from_pdf(pdf_path)
    return processor.create_chunks(text)