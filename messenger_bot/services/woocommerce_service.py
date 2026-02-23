"""
WooCommerce Service
Handles product sync, embedding generation, and cart operations via WooCommerce REST API.
"""

import logging
import requests
from typing import Dict, List, Optional
from decimal import Decimal
from django.utils import timezone

logger = logging.getLogger(__name__)


class WooCommerceService:
    """Handles WooCommerce REST API operations"""

    def __init__(self, ecommerce_settings):
        self.settings = ecommerce_settings
        self.base_url = ecommerce_settings.store_url.rstrip('/')
        self.consumer_key = ecommerce_settings.consumer_key
        self.consumer_secret = ecommerce_settings.consumer_secret

    def _api_url(self, endpoint: str) -> str:
        return f"{self.base_url}/wp-json/wc/v3/{endpoint}"

    def _auth_params(self) -> dict:
        return {
            'consumer_key': self.consumer_key,
            'consumer_secret': self.consumer_secret,
        }

    def _get(self, endpoint: str, params: Optional[dict] = None) -> requests.Response:
        """Make authenticated GET request to WooCommerce API"""
        url = self._api_url(endpoint)
        all_params = self._auth_params()
        if params:
            all_params.update(params)
        response = requests.get(url, params=all_params, timeout=30)
        return response

    def test_connection(self) -> dict:
        """Test WooCommerce API connection"""
        try:
            response = self._get('system_status')
            if response.status_code == 200:
                data = response.json()
                return {
                    'success': True,
                    'message': 'Connected successfully!',
                    'store_name': data.get('environment', {}).get('site_url', self.base_url),
                    'wc_version': data.get('environment', {}).get('version', 'Unknown'),
                }
            elif response.status_code == 401:
                return {'success': False, 'message': 'Authentication failed. Check your consumer key and secret.'}
            else:
                return {'success': False, 'message': f'Connection failed with status {response.status_code}'}
        except requests.ConnectionError:
            return {'success': False, 'message': f'Could not connect to {self.base_url}. Check the URL.'}
        except requests.Timeout:
            return {'success': False, 'message': 'Connection timed out. The store may be slow or unreachable.'}
        except Exception as e:
            return {'success': False, 'message': f'Connection error: {str(e)}'}

    def sync_products(self) -> dict:
        """Fetch all products from WooCommerce and sync to local DB"""
        from ..models import Product

        try:
            all_products = []
            page = 1
            per_page = 100

            # Paginate through all products
            while True:
                response = self._get('products', {
                    'per_page': per_page,
                    'page': page,
                    'status': 'publish',
                })

                if response.status_code != 200:
                    return {
                        'success': False,
                        'error': f'API returned status {response.status_code}: {response.text[:200]}',
                    }

                products = response.json()
                if not products:
                    break

                all_products.extend(products)
                page += 1

                # Safety limit
                if page > 50:
                    break

            logger.info(f"Fetched {len(all_products)} products from WooCommerce")

            created = 0
            updated = 0

            for woo_product in all_products:
                woo_id = woo_product.get('id')
                if not woo_id:
                    continue

                # Parse images
                images = []
                for img in woo_product.get('images', []):
                    images.append({
                        'id': img.get('id'),
                        'src': img.get('src', ''),
                        'name': img.get('name', ''),
                        'alt': img.get('alt', ''),
                    })

                # Parse categories
                categories = []
                for cat in woo_product.get('categories', []):
                    categories.append({
                        'id': cat.get('id'),
                        'name': cat.get('name', ''),
                        'slug': cat.get('slug', ''),
                    })

                # Parse prices
                price = Decimal(woo_product.get('price') or '0')
                regular_price = Decimal(woo_product.get('regular_price') or '0')
                sale_price_str = woo_product.get('sale_price')
                sale_price = Decimal(sale_price_str) if sale_price_str else None

                product, is_created = Product.objects.update_or_create(
                    ecommerce_settings=self.settings,
                    woo_product_id=woo_id,
                    defaults={
                        'name': woo_product.get('name', ''),
                        'description': woo_product.get('description', ''),
                        'short_description': woo_product.get('short_description', ''),
                        'price': price,
                        'regular_price': regular_price,
                        'sale_price': sale_price,
                        'sku': woo_product.get('sku', ''),
                        'stock_status': woo_product.get('stock_status', 'instock'),
                        'stock_quantity': woo_product.get('stock_quantity'),
                        'permalink': woo_product.get('permalink', ''),
                        'images': images,
                        'categories': categories,
                    }
                )

                if is_created:
                    created += 1
                else:
                    updated += 1

            # Update last_synced
            self.settings.last_synced = timezone.now()
            self.settings.save(update_fields=['last_synced'])

            logger.info(f"Product sync complete: {created} created, {updated} updated")

            return {
                'success': True,
                'synced': len(all_products),
                'created': created,
                'updated': updated,
            }

        except Exception as e:
            logger.error(f"Product sync failed: {e}")
            return {'success': False, 'error': str(e)}

    def generate_product_embeddings(self, openai_api_key: str) -> dict:
        """Generate embeddings for all products using OpenAI"""
        from ..models import Product
        from .openai_client import OpenAIClient

        try:
            products = list(Product.objects.filter(ecommerce_settings=self.settings))
            if not products:
                return {'success': False, 'error': 'No products to generate embeddings for. Sync products first.'}

            # Build embedding text for each product
            texts = []
            for product in products:
                cat_names = ', '.join(c.get('name', '') for c in (product.categories or []))
                text = (
                    f"{product.name}. "
                    f"{product.short_description} "
                    f"{product.description[:500]} "
                    f"Categories: {cat_names}. "
                    f"Price: {self.settings.currency_symbol}{product.price}. "
                    f"SKU: {product.sku}."
                )
                # Clean HTML tags
                import re
                text = re.sub(r'<[^>]+>', '', text)
                text = re.sub(r'\s+', ' ', text).strip()
                texts.append(text)

            # Generate embeddings in batch
            client = OpenAIClient(api_key=openai_api_key)
            embeddings = client.create_embeddings_batch(texts)

            # Store embeddings
            for product, embedding in zip(products, embeddings):
                product.set_embedding(embedding)
                product.save(update_fields=['embedding'])

            logger.info(f"Generated embeddings for {len(products)} products")

            return {
                'success': True,
                'total': len(products),
            }

        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            return {'success': False, 'error': str(e)}

    def add_to_cart(self, woo_product_id: int, quantity: int = 1) -> dict:
        """
        Generate a cart URL for the product.
        WooCommerce supports adding to cart via URL: ?add-to-cart=PRODUCT_ID&quantity=N
        """
        cart_url = f"{self.base_url}/?add-to-cart={woo_product_id}&quantity={quantity}"
        return {
            'success': True,
            'cart_url': cart_url,
            'product_id': woo_product_id,
            'quantity': quantity,
        }
