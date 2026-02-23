# ai_image/product_compositor.py

"""
Product Image Compositor Service
- Removes product background (supports rembg or fallback edge-detection)
- Composites product onto AI-generated scene
- Adds shadow effects for realism
"""

import io
import logging
from PIL import Image, ImageFilter, ImageDraw
import numpy as np

logger = logging.getLogger(__name__)


class ProductCompositor:
    """Handles product background removal and scene compositing"""
    
    def __init__(self, remove_bg=True):
        self.remove_bg = remove_bg
        self._rembg_available = None
    
    @property
    def rembg_available(self):
        """Check if rembg is installed"""
        if self._rembg_available is None:
            try:
                import rembg
                self._rembg_available = True
            except ImportError:
                self._rembg_available = False
        return self._rembg_available
    
    def remove_background(self, product_image_data):
        """
        Remove background from product image.
        Uses rembg if available, falls back to edge-based detection.
        
        Args:
            product_image_data: bytes of the product image
        Returns:
            PIL Image with transparent background (RGBA)
        """
        try:
            img = Image.open(io.BytesIO(product_image_data))
            
            # Try rembg first (best quality)
            if self.rembg_available:
                return self._remove_bg_rembg(product_image_data)
            
            # Fallback: edge-based background detection
            return self._remove_bg_fallback(img)
            
        except Exception as e:
            logger.error(f"Background removal failed: {e}")
            # Return as RGBA without removal
            img = Image.open(io.BytesIO(product_image_data))
            return img.convert('RGBA')
    
    def _remove_bg_rembg(self, image_data):
        """Remove background using rembg (AI-powered)"""
        import rembg
        output = rembg.remove(image_data)
        return Image.open(io.BytesIO(output)).convert('RGBA')
    
    def _remove_bg_fallback(self, img):
        """
        Fallback background removal using edge detection.
        Samples corners to detect background color and creates alpha mask.
        """
        img = img.convert('RGBA')
        data = np.array(img)
        
        h, w = data.shape[:2]
        sample_size = max(10, min(h, w) // 20)
        
        # Sample corners for background color
        corners = [
            data[:sample_size, :sample_size, :3],          # top-left
            data[:sample_size, -sample_size:, :3],          # top-right
            data[-sample_size:, :sample_size, :3],          # bottom-left
            data[-sample_size:, -sample_size:, :3],         # bottom-right
        ]
        
        bg_samples = np.concatenate([c.reshape(-1, 3) for c in corners])
        bg_color = np.median(bg_samples, axis=0)
        
        # Calculate distance from background color
        diff = np.sqrt(np.sum((data[:, :, :3].astype(float) - bg_color.astype(float)) ** 2, axis=2))
        
        # Create alpha mask with tolerance
        tolerance = 50
        alpha = np.where(diff < tolerance, 0, 255).astype(np.uint8)
        
        # Smooth edges
        alpha_img = Image.fromarray(alpha, mode='L')
        alpha_img = alpha_img.filter(ImageFilter.GaussianBlur(radius=2))
        
        data[:, :, 3] = np.array(alpha_img)
        return Image.fromarray(data, 'RGBA')
    
    def composite_product(self, scene_image_data, product_image_data, 
                          position='center', scale=50, add_shadow=True):
        """
        Composite product onto AI-generated scene.
        
        Args:
            scene_image_data: bytes of the AI-generated scene
            product_image_data: bytes of the product image
            position: where to place product ('center', 'center_bottom', 'left', 'right', 'center_top', 'full')
            scale: product size as percentage of scene (20-90)
            add_shadow: whether to add drop shadow
        Returns:
            bytes of the final composited image (PNG)
        """
        try:
            # Open scene
            scene = Image.open(io.BytesIO(scene_image_data)).convert('RGBA')
            scene_w, scene_h = scene.size
            
            # Remove product background
            if self.remove_bg:
                product = self.remove_background(product_image_data)
            else:
                product = Image.open(io.BytesIO(product_image_data)).convert('RGBA')
            
            # Scale product
            scale = max(20, min(90, scale))
            target_w = int(scene_w * scale / 100)
            product_ratio = product.height / product.width
            target_h = int(target_w * product_ratio)
            
            # Ensure product doesn't exceed scene height
            if target_h > int(scene_h * 0.85):
                target_h = int(scene_h * 0.85)
                target_w = int(target_h / product_ratio)
            
            product = product.resize((target_w, target_h), Image.LANCZOS)
            
            # Calculate position
            x, y = self._calculate_position(scene_w, scene_h, target_w, target_h, position)
            
            # Add shadow
            if add_shadow:
                shadow = self._create_shadow(product, offset=(5, 8))
                scene.paste(shadow, (x + 5, y + 8), shadow)
            
            # Paste product
            scene.paste(product, (x, y), product)
            
            # Convert to RGB for output
            final = Image.new('RGB', scene.size, (255, 255, 255))
            final.paste(scene, mask=scene.split()[3] if scene.mode == 'RGBA' else None)
            
            output = io.BytesIO()
            final.save(output, format='PNG', quality=95)
            return output.getvalue()
            
        except Exception as e:
            logger.error(f"Compositing failed: {e}")
            # Return scene as-is on error
            return scene_image_data
    
    def _calculate_position(self, scene_w, scene_h, prod_w, prod_h, position):
        """Calculate x, y coordinates for product placement"""
        positions = {
            'center': (
                (scene_w - prod_w) // 2,
                (scene_h - prod_h) // 2
            ),
            'center_bottom': (
                (scene_w - prod_w) // 2,
                scene_h - prod_h - int(scene_h * 0.05)
            ),
            'left': (
                int(scene_w * 0.08),
                (scene_h - prod_h) // 2
            ),
            'right': (
                scene_w - prod_w - int(scene_w * 0.08),
                (scene_h - prod_h) // 2
            ),
            'center_top': (
                (scene_w - prod_w) // 2,
                int(scene_h * 0.05)
            ),
            'full': (
                (scene_w - prod_w) // 2,
                (scene_h - prod_h) // 2
            ),
        }
        return positions.get(position, positions['center'])
    
    def _create_shadow(self, image, offset=(5, 8), shadow_color=(0, 0, 0, 80)):
        """Create a soft drop shadow for the product"""
        shadow = Image.new('RGBA', image.size, (0, 0, 0, 0))
        
        # Use product alpha as shadow shape
        if image.mode == 'RGBA':
            alpha = image.split()[3]
            shadow_layer = Image.new('RGBA', image.size, shadow_color)
            shadow.paste(shadow_layer, mask=alpha)
            shadow = shadow.filter(ImageFilter.GaussianBlur(radius=10))
        
        return shadow


def enhance_product_prompt(original_prompt):
    """
    Modify user's prompt to generate scene-only background.
    When user uploads a product, we want AI to generate ONLY the background/scene.
    The uploaded media contains the user's product — AI generates a matching scene for it.
    """
    enhanced = (
        f"The user has uploaded their own product image. "
        f"Generate a professional product photography background/scene based on this description: {original_prompt}. "
        f"This scene will be used to showcase the user's product. "
        f"Create a clean, professional environment that complements a product placement. "
        f"Leave clear space in the center of the composition for the product to be placed. "
        f"Do NOT generate any product or object in the image — only the background, scene, and environment."
    )
    return enhanced


def get_product_negative_prompt(existing_negative=''):
    """Add product-exclusion terms to negative prompt"""
    product_negatives = "product, item, object in center, subject in foreground"
    if existing_negative:
        return f"{existing_negative}, {product_negatives}"
    return product_negatives
