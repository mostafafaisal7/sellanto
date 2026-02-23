"""
Brand DNA Service
Crawls a brand's website, extracts text, chunks it, and creates embeddings
for use as additional RAG knowledge alongside PDF documents.
"""

import logging
import re
import time
from typing import List, Dict, Optional
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)


class BrandDNAService:
    """Handles website crawling, text extraction, chunking, and embedding for Brand DNA."""

    def __init__(self, openai_api_key: str, embedding_model: str = "text-embedding-3-small"):
        self.openai_api_key = openai_api_key
        self.embedding_model = embedding_model

    def crawl_website(self, base_url: str, max_pages: int = 50) -> List[Dict[str, str]]:
        """
        Crawl a website starting from base_url, discovering same-domain links.

        Returns list of {url, title, content} for each page.
        """
        parsed_base = urlparse(base_url)
        base_domain = parsed_base.netloc

        visited = set()
        to_visit = [base_url]
        pages = []

        headers = {
            'User-Agent': 'Mozilla/5.0 (compatible; SocialSyncBot/1.0; Brand DNA Crawler)'
        }

        while to_visit and len(pages) < max_pages:
            url = to_visit.pop(0)

            # Normalize URL
            url = url.split('#')[0].rstrip('/')
            if url in visited:
                continue
            visited.add(url)

            try:
                response = requests.get(url, headers=headers, timeout=15, allow_redirects=True)
                if response.status_code != 200:
                    continue
                content_type = response.headers.get('Content-Type', '')
                if 'text/html' not in content_type:
                    continue

                soup = BeautifulSoup(response.text, 'html.parser')

                # Remove script, style, nav, footer, header tags
                for tag in soup(['script', 'style', 'nav', 'footer', 'header', 'noscript', 'iframe']):
                    tag.decompose()

                # Get page title
                title = ''
                if soup.title and soup.title.string:
                    title = soup.title.string.strip()

                # Extract main content text
                # Try to find main content area first
                main_content = soup.find('main') or soup.find('article') or soup.find('body')
                if main_content:
                    text = main_content.get_text(separator='\n', strip=True)
                else:
                    text = soup.get_text(separator='\n', strip=True)

                # Clean up text
                text = self._clean_text(text)

                if len(text) > 100:  # Only include pages with meaningful content
                    pages.append({
                        'url': url,
                        'title': title,
                        'content': text
                    })
                    logger.info(f"Crawled: {url} ({len(text)} chars)")

                # Discover same-domain links
                for link in soup.find_all('a', href=True):
                    href = link['href']
                    full_url = urljoin(url, href).split('#')[0].rstrip('/')
                    parsed = urlparse(full_url)

                    if (parsed.netloc == base_domain
                            and full_url not in visited
                            and parsed.scheme in ('http', 'https')
                            and not self._should_skip_url(full_url)):
                        to_visit.append(full_url)

                # Be polite - small delay between requests
                time.sleep(0.5)

            except Exception as e:
                logger.warning(f"Error crawling {url}: {e}")
                continue

        logger.info(f"Crawled {len(pages)} pages from {base_domain}")
        return pages

    def _should_skip_url(self, url: str) -> bool:
        """Skip URLs that are unlikely to contain useful content."""
        skip_extensions = (
            '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp',
            '.mp3', '.mp4', '.avi', '.zip', '.tar', '.gz',
            '.css', '.js', '.xml', '.json', '.ico'
        )
        skip_patterns = (
            '/login', '/signup', '/register', '/cart', '/checkout',
            '/admin', '/wp-admin', '/feed', '/rss'
        )
        lower_url = url.lower()
        return (any(lower_url.endswith(ext) for ext in skip_extensions)
                or any(pattern in lower_url for pattern in skip_patterns))

    def _clean_text(self, text: str) -> str:
        """Clean extracted text."""
        # Remove excessive whitespace
        text = re.sub(r'\n{3,}', '\n\n', text)
        text = re.sub(r' {2,}', ' ', text)
        # Remove very short lines (likely navigation remnants)
        lines = text.split('\n')
        lines = [line.strip() for line in lines if len(line.strip()) > 2]
        return '\n'.join(lines)

    def chunk_text(
        self,
        text: str,
        metadata: Dict[str, str],
        chunk_size: int = 1000,
        chunk_overlap: int = 200
    ) -> List[Dict]:
        """
        Split text into overlapping chunks.

        Returns list of {text, chunk_index, source_url, page_title}.
        """
        chunks = []
        start = 0
        index = 0

        while start < len(text):
            end = start + chunk_size

            # Try to break at a sentence boundary
            if end < len(text):
                for sep in ['. ', '.\n', '\n\n', '\n', ' ']:
                    last_sep = text[start:end].rfind(sep)
                    if last_sep > chunk_size * 0.5:
                        end = start + last_sep + len(sep)
                        break

            chunk_text = text[start:end].strip()
            if chunk_text:
                chunks.append({
                    'text': chunk_text,
                    'chunk_index': index,
                    'source_url': metadata['url'],
                    'page_title': metadata['title'],
                })
                index += 1

            start = end - chunk_overlap
            if start < 0:
                start = 0
            if end >= len(text):
                break

        return chunks

    def generate_brand_dna(self, brand) -> Dict:
        """
        Main method: crawl website, chunk content, create embeddings, store in DB.

        Args:
            brand: Brand model instance (must have website_url)

        Returns:
            dict with success status and stats
        """
        from brands.models import BrandDNAChunk
        from messenger_bot.services.openai_client import OpenAIClient

        if not brand.website_url:
            return {'success': False, 'error': 'Brand has no website URL configured'}

        try:
            # Step 1: Crawl website
            logger.info(f"Starting Brand DNA generation for: {brand.brand_name}")
            pages = self.crawl_website(brand.website_url)

            if not pages:
                return {'success': False, 'error': 'No content could be extracted from the website'}

            # Step 2: Chunk all page content
            all_chunks = []
            for page in pages:
                page_chunks = self.chunk_text(
                    page['content'],
                    {'url': page['url'], 'title': page['title']}
                )
                all_chunks.extend(page_chunks)

            if not all_chunks:
                return {'success': False, 'error': 'No text chunks were generated'}

            logger.info(f"Created {len(all_chunks)} chunks from {len(pages)} pages")

            # Step 3: Create embeddings
            openai_client = OpenAIClient(api_key=self.openai_api_key)
            chunk_texts = [c['text'] for c in all_chunks]
            embeddings = openai_client.create_embeddings_batch(
                chunk_texts,
                model=self.embedding_model
            )

            logger.info(f"Created {len(embeddings)} embeddings")

            # Step 4: Store in database
            with transaction.atomic():
                # Delete old chunks
                BrandDNAChunk.objects.filter(brand=brand).delete()

                # Create new chunks
                dna_chunks = []
                for chunk_data, embedding in zip(all_chunks, embeddings):
                    chunk = BrandDNAChunk(
                        brand=brand,
                        text=chunk_data['text'],
                        chunk_index=chunk_data['chunk_index'],
                        source_url=chunk_data['source_url'],
                        page_title=chunk_data['page_title'],
                    )
                    chunk.set_embedding(embedding)
                    dna_chunks.append(chunk)

                BrandDNAChunk.objects.bulk_create(dna_chunks)

                # Step 5: Update brand DNA metadata
                brand.brand_dna = {
                    'pages_crawled': len(pages),
                    'total_chunks': len(all_chunks),
                    'website_url': brand.website_url,
                    'page_titles': [p['title'] for p in pages[:20]],
                }
                brand.brand_dna_generated_at = timezone.now()
                brand.brand_dna_source = 'website'
                brand.save()

            logger.info(f"Brand DNA generation complete for: {brand.brand_name}")

            return {
                'success': True,
                'pages_crawled': len(pages),
                'total_chunks': len(all_chunks),
            }

        except Exception as e:
            logger.error(f"Brand DNA generation failed: {e}")
            return {'success': False, 'error': str(e)}
