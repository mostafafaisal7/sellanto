"""
Image Resize Service
- Auto-resize pipeline using Pillow
- Platform dimension map
- Store variants in AssetPlatformVariant
"""
import os
import logging
from io import BytesIO

from django.core.files.base import ContentFile

logger = logging.getLogger(__name__)

# Platform dimension map: format -> (width, height)
PLATFORM_DIMENSIONS = {
    'instagram': {
        'feed': (1080, 1080),
        'story': (1080, 1920),
        'reel': (1080, 1920),
    },
    'linkedin': {
        'feed': (1200, 627),
        'article': (1200, 644),
    },
    'twitter': {
        'feed': (1200, 675),
        'header': (1500, 500),
    },
    'facebook': {
        'feed': (1200, 630),
        'story': (1080, 1920),
        'cover': (820, 312),
    },
}


def resize_image_for_platforms(image_generation, platforms=None):
    """Resize an image for all specified platforms.

    Args:
        image_generation: ImageGeneration model instance with generated_image
        platforms: List of platform strings. If None, generates for all.

    Returns:
        list: Created AssetPlatformVariant objects
    """
    try:
        from PIL import Image
    except ImportError:
        logger.error("Pillow is required for image resize. Install with: pip install Pillow")
        return []

    from ai_image.models import AssetPlatformVariant

    # Get the source image
    source_image_field = image_generation.generated_image_with_logo or image_generation.generated_image
    if not source_image_field:
        logger.warning(f"No source image for ImageGeneration #{image_generation.id}")
        return []

    try:
        source_img = Image.open(source_image_field.path)
    except Exception as e:
        logger.error(f"Failed to open source image: {e}")
        return []

    if platforms is None:
        platforms = list(PLATFORM_DIMENSIONS.keys())

    created = []
    for platform in platforms:
        formats = PLATFORM_DIMENSIONS.get(platform, {})
        for format_label, (width, height) in formats.items():
            try:
                # Resize with aspect ratio awareness
                resized = _smart_resize(source_img.copy(), width, height)

                # Save to buffer
                buffer = BytesIO()
                resized.save(buffer, format='PNG', quality=95)
                buffer.seek(0)

                dimensions_str = f"{width}x{height}"
                filename = f"variant_{image_generation.id}_{platform}_{format_label}_{dimensions_str}.png"

                variant = AssetPlatformVariant.objects.create(
                    asset=image_generation,
                    platform=platform,
                    format_label=format_label,
                    dimensions=dimensions_str,
                )
                variant.file_url.save(filename, ContentFile(buffer.read()), save=True)
                created.append(variant)

            except Exception as e:
                logger.error(f"Failed to resize for {platform}/{format_label}: {e}")
                continue

    return created


def _smart_resize(img, target_width, target_height):
    """Resize with center-crop to maintain aspect ratio."""
    from PIL import Image

    # Calculate aspect ratios
    target_ratio = target_width / target_height
    img_ratio = img.width / img.height

    if img_ratio > target_ratio:
        # Image is wider - crop sides
        new_width = int(img.height * target_ratio)
        left = (img.width - new_width) // 2
        img = img.crop((left, 0, left + new_width, img.height))
    elif img_ratio < target_ratio:
        # Image is taller - crop top/bottom
        new_height = int(img.width / target_ratio)
        top = (img.height - new_height) // 2
        img = img.crop((0, top, img.width, top + new_height))

    # Resize to exact dimensions
    img = img.resize((target_width, target_height), Image.LANCZOS)
    return img
