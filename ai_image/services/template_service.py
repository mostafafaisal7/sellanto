"""
Brand Template Overlay Service
- Logo overlay at configured position
- Color/font application using Pillow
"""
import logging
from io import BytesIO

from django.core.files.base import ContentFile

logger = logging.getLogger(__name__)

# Logo position coordinates (as proportion of image dimensions)
POSITION_MAP = {
    'top_left': (0.02, 0.02),
    'top_right': (0.82, 0.02),
    'bottom_left': (0.02, 0.88),
    'bottom_right': (0.82, 0.88),
    'center': (0.40, 0.40),
}


def apply_brand_template(image_generation, brand_template):
    """Apply a brand template overlay to an image.

    Args:
        image_generation: ImageGeneration model instance
        brand_template: BrandTemplate model instance

    Returns:
        Updated ImageGeneration object or None on failure
    """
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        logger.error("Pillow is required for template overlay")
        return None

    source_field = image_generation.generated_image
    if not source_field:
        logger.warning("No source image available")
        return None

    try:
        base_img = Image.open(source_field.path).convert('RGBA')
    except Exception as e:
        logger.error(f"Failed to open source image: {e}")
        return None

    # Apply logo from template if available
    if brand_template.template_file:
        try:
            logo = Image.open(brand_template.template_file.path).convert('RGBA')

            # Calculate logo size (15% of smallest image dimension)
            max_logo_dim = int(min(base_img.width, base_img.height) * 0.15)
            logo.thumbnail((max_logo_dim, max_logo_dim), Image.LANCZOS)

            # Get position
            pos_ratios = POSITION_MAP.get(brand_template.logo_position, POSITION_MAP['bottom_right'])
            x = int(base_img.width * pos_ratios[0])
            y = int(base_img.height * pos_ratios[1])

            # Paste with transparency
            base_img.paste(logo, (x, y), logo)

        except Exception as e:
            logger.error(f"Failed to apply logo overlay: {e}")

    # Convert back to RGB for saving
    final = base_img.convert('RGB')

    # Save back
    buffer = BytesIO()
    final.save(buffer, format='PNG', quality=95)
    buffer.seek(0)

    filename = f"branded_{image_generation.id}_{brand_template.id}.png"
    image_generation.generated_image_with_logo.save(
        filename, ContentFile(buffer.read()), save=True
    )
    image_generation.brand_template = brand_template
    image_generation.save(update_fields=['brand_template'])

    return image_generation
