# video_studio/services/image_processor.py

"""
Product Image Processor
Prepare product images for Veo image-to-video generation
"""

from PIL import Image, ImageEnhance, ImageFilter, ImageDraw
import io


class ProductImageProcessor:
    """
    Prepare product images for optimal Veo image-to-video generation
    """

    def preprocess_for_veo(self, image_source, remove_background=False, canvas_size=(1920, 1080)):
        """
        Prepare product image for Veo image-to-video

        Args:
            image_source (str or bytes): Image file path or bytes
            remove_background (bool): Whether to remove background
            canvas_size (tuple): Output canvas size (width, height)

        Returns:
            bytes: Optimized JPEG image data
        """
        try:
            # Load image
            if isinstance(image_source, bytes):
                img = Image.open(io.BytesIO(image_source))
            else:
                img = Image.open(image_source)

            # Convert to RGBA for processing
            if img.mode != 'RGBA':
                img = img.convert('RGBA')

            # Step 1: Remove background if requested
            if remove_background:
                img = self._remove_background(img)

            # Step 2: Center product on canvas
            img = self._center_on_canvas(img, canvas_size)

            # Step 3: Enhance quality
            img = self._enhance_quality(img)

            # Step 4: Add subtle lighting (optional)
            # img = self._add_studio_lighting(img)

            # Step 5: Convert back to RGB and save as JPEG
            if img.mode == 'RGBA':
                # Create white background
                background = Image.new('RGB', img.size, (255, 255, 255))
                background.paste(img, mask=img.split()[3])
                img = background

            # Save to bytes
            output = io.BytesIO()
            img.save(output, format='JPEG', quality=95, optimize=True)

            return output.getvalue()

        except Exception as e:
            print(f"Failed to preprocess image: {e}")
            # Return original if processing fails
            if isinstance(image_source, bytes):
                return image_source
            else:
                with open(image_source, 'rb') as f:
                    return f.read()

    def _remove_background(self, img):
        """
        Remove background using rembg library

        Args:
            img (PIL.Image): Input image

        Returns:
            PIL.Image: Image with background removed
        """
        try:
            from rembg import remove

            # Convert to bytes
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            buffer.seek(0)

            # Remove background
            output = remove(buffer.read())

            # Convert back to PIL Image
            return Image.open(io.BytesIO(output))

        except ImportError:
            print("rembg not installed. Skipping background removal.")
            return img
        except Exception as e:
            print(f"Background removal failed: {e}")
            return img

    def _center_on_canvas(self, img, canvas_size):
        """
        Center product on larger canvas with transparent/white background

        Args:
            img (PIL.Image): Input image
            canvas_size (tuple): (width, height)

        Returns:
            PIL.Image: Centered image on canvas
        """
        try:
            # Create canvas
            canvas = Image.new('RGBA', canvas_size, (255, 255, 255, 0))

            # Calculate scale to fit product nicely (80% of canvas)
            max_product_width = int(canvas_size[0] * 0.8)
            max_product_height = int(canvas_size[1] * 0.8)

            # Calculate scaling
            scale_w = max_product_width / img.width
            scale_h = max_product_height / img.height
            scale = min(scale_w, scale_h)

            # Resize if needed
            if scale < 1:
                new_width = int(img.width * scale)
                new_height = int(img.height * scale)
                img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

            # Calculate centered position
            x = (canvas_size[0] - img.width) // 2
            y = (canvas_size[1] - img.height) // 2

            # Paste centered
            canvas.paste(img, (x, y), img if img.mode == 'RGBA' else None)

            return canvas

        except Exception as e:
            print(f"Failed to center on canvas: {e}")
            return img

    def _enhance_quality(self, img):
        """
        Enhance image quality (sharpness, contrast)

        Args:
            img (PIL.Image): Input image

        Returns:
            PIL.Image: Enhanced image
        """
        try:
            # Sharpen slightly
            enhancer = ImageEnhance.Sharpness(img)
            img = enhancer.enhance(1.2)

            # Increase contrast slightly
            enhancer = ImageEnhance.Contrast(img)
            img = enhancer.enhance(1.1)

            # Slightly boost color
            enhancer = ImageEnhance.Color(img)
            img = enhancer.enhance(1.05)

            return img

        except Exception as e:
            print(f"Failed to enhance quality: {e}")
            return img

    def _add_studio_lighting(self, img):
        """
        Add subtle studio lighting effect (vignette/gradient)

        Args:
            img (PIL.Image): Input image

        Returns:
            PIL.Image: Image with lighting effect
        """
        try:
            # Create radial gradient overlay
            overlay = Image.new('RGBA', img.size, (255, 255, 255, 0))
            draw = ImageDraw.Draw(overlay)

            # Create vignette (darker at edges, lighter in center)
            center_x, center_y = img.width // 2, img.height // 2
            max_radius = max(img.width, img.height) // 2

            for i in range(20):
                alpha = int((i / 20) * 40)  # Max 40 alpha
                radius = max_radius * (1 - i / 20)

                bbox = [
                    center_x - radius,
                    center_y - radius,
                    center_x + radius,
                    center_y + radius
                ]

                draw.ellipse(bbox, fill=(0, 0, 0, alpha))

            # Composite
            result = Image.alpha_composite(img.convert('RGBA'), overlay)

            return result

        except Exception as e:
            print(f"Failed to add lighting: {e}")
            return img

    def create_thumbnail(self, image_source, size=(320, 180)):
        """
        Create thumbnail from image

        Args:
            image_source (str or bytes): Image file path or bytes
            size (tuple): Thumbnail size (width, height)

        Returns:
            bytes: Thumbnail JPEG data
        """
        try:
            # Load image
            if isinstance(image_source, bytes):
                img = Image.open(io.BytesIO(image_source))
            else:
                img = Image.open(image_source)

            # Convert to RGB
            if img.mode != 'RGB':
                img = img.convert('RGB')

            # Create thumbnail maintaining aspect ratio
            img.thumbnail(size, Image.Resampling.LANCZOS)

            # Save to bytes
            output = io.BytesIO()
            img.save(output, format='JPEG', quality=85, optimize=True)

            return output.getvalue()

        except Exception as e:
            print(f"Failed to create thumbnail: {e}")
            return None

    def extract_first_frame_from_video(self, video_path):
        """
        Extract first frame from video as image

        Args:
            video_path (str): Path to video file

        Returns:
            bytes: JPEG image data of first frame
        """
        try:
            from moviepy.editor import VideoFileClip

            clip = VideoFileClip(video_path)

            # Get first frame
            frame = clip.get_frame(0)

            # Convert to PIL Image
            img = Image.fromarray(frame)

            # Save to bytes
            buffer = io.BytesIO()
            img.save(buffer, format='JPEG', quality=90)

            clip.close()

            return buffer.getvalue()

        except Exception as e:
            print(f"Failed to extract first frame: {e}")
            return None

    def resize_for_aspect_ratio(self, image_source, aspect_ratio='16:9'):
        """
        Resize/crop image to specific aspect ratio

        Args:
            image_source (str or bytes): Image file path or bytes
            aspect_ratio (str): Target aspect ratio ('16:9', '9:16', '1:1', '4:5')

        Returns:
            bytes: Resized JPEG image data
        """
        try:
            # Load image
            if isinstance(image_source, bytes):
                img = Image.open(io.BytesIO(image_source))
            else:
                img = Image.open(image_source)

            # Parse aspect ratio
            aspect_ratios = {
                '16:9': 16/9,
                '9:16': 9/16,
                '1:1': 1/1,
                '4:5': 4/5,
                '4:3': 4/3,
            }

            target_ratio = aspect_ratios.get(aspect_ratio, 16/9)

            # Calculate current ratio
            current_ratio = img.width / img.height

            # Crop to target ratio
            if current_ratio > target_ratio:
                # Too wide, crop width
                new_width = int(img.height * target_ratio)
                left = (img.width - new_width) // 2
                img = img.crop((left, 0, left + new_width, img.height))
            elif current_ratio < target_ratio:
                # Too tall, crop height
                new_height = int(img.width / target_ratio)
                top = (img.height - new_height) // 2
                img = img.crop((0, top, img.width, top + new_height))

            # Convert to RGB if needed
            if img.mode != 'RGB':
                img = img.convert('RGB')

            # Save to bytes
            output = io.BytesIO()
            img.save(output, format='JPEG', quality=95, optimize=True)

            return output.getvalue()

        except Exception as e:
            print(f"Failed to resize for aspect ratio: {e}")
            return image_source if isinstance(image_source, bytes) else None
