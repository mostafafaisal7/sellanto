# ai_image/openai_service.py

"""
OpenAI DALL-E API Service for AI Image Generation
Uses requests library - NO SDK needed
Install: pip install requests Pillow
"""

import io
import time
import base64
import requests
from PIL import Image
from django.conf import settings


class OpenAIImageService:
    """
    AI Image Generator using OpenAI DALL-E API (REST)
    Supports DALL-E 2 and DALL-E 3
    """
    
    def __init__(self, api_key=None):
        self.api_key = api_key or getattr(settings, 'OPENAI_API_KEY', None)
        self.base_url = "https://api.openai.com/v1"
    
    def _get_style_prompt(self, style):
        """Get style-specific prompt additions"""
        style_prompts = {
            'realistic': "photorealistic, highly detailed, 8k resolution, professional photography",
            'artistic': "artistic, creative, expressive brushstrokes, fine art style",
            'anime': "anime style, manga art, vibrant colors, Japanese animation aesthetic",
            'cartoon': "cartoon style, bold outlines, bright colors, playful, illustrated",
            '3d_render': "3D rendered, CGI, volumetric lighting, ray tracing, octane render",
            'watercolor': "watercolor painting, soft edges, flowing colors, paper texture",
            'oil_painting': "oil painting, rich textures, classical art style, canvas texture",
            'digital_art': "digital art, modern, clean lines, vibrant, concept art style",
            'pixel_art': "pixel art, retro game style, 16-bit, nostalgic, crisp pixels",
            'sketch': "pencil sketch, hand-drawn, artistic lines, shading, detailed drawing",
            'cinematic': "cinematic, movie scene, dramatic lighting, widescreen, film grain",
            'fantasy': "fantasy art, magical, ethereal, mystical atmosphere, epic",
            'minimalist': "minimalist, simple, clean, modern design, negative space",
            'vintage': "vintage, retro, nostalgic, aged look, classic aesthetic",
            'neon': "neon lights, cyberpunk, futuristic, glowing, vibrant colors, sci-fi",
            'vivid': "vivid colors, hyper-detailed, dramatic, bold",
            'natural': "natural, soft lighting, realistic, subtle tones",
        }
        return style_prompts.get(style, "high quality, detailed")
    
    def _get_lighting_prompt(self, lighting):
        """Get lighting-specific prompt additions"""
        lighting_prompts = {
            'natural': "natural lighting, soft shadows, outdoor light",
            'studio': "studio lighting, professional, controlled light, softbox",
            'dramatic': "dramatic lighting, high contrast, chiaroscuro, moody",
            'soft': "soft diffused light, gentle shadows, even illumination",
            'golden_hour': "golden hour lighting, warm tones, sunset glow",
            'neon': "neon lighting, colorful glow, cyberpunk atmosphere",
            'backlit': "backlit, silhouette edges, rim lighting, glowing outline",
        }
        return lighting_prompts.get(lighting, "")
    
    def _get_camera_prompt(self, camera_angle):
        """Get camera angle prompt additions"""
        camera_prompts = {
            'front': "front view, facing camera, straight on",
            'side': "side view, profile shot, lateral angle",
            'aerial': "aerial view, bird's eye view, top down perspective",
            'low_angle': "low angle shot, looking up, powerful perspective",
            'high_angle': "high angle shot, looking down, overview",
            'closeup': "close-up shot, detailed, intimate framing",
            'wide': "wide shot, full scene, environmental context",
            'macro': "macro shot, extreme close-up, fine details visible",
        }
        return camera_prompts.get(camera_angle, "")
    
    def enhance_prompt(self, prompt, style='realistic', lighting=None, camera_angle=None):
        """Enhance user prompt with style and technical details"""
        enhanced_parts = [prompt]
        
        # Add style
        style_addition = self._get_style_prompt(style)
        if style_addition:
            enhanced_parts.append(style_addition)
        
        # Add lighting
        if lighting:
            lighting_addition = self._get_lighting_prompt(lighting)
            if lighting_addition:
                enhanced_parts.append(lighting_addition)
        
        # Add camera angle
        if camera_angle:
            camera_addition = self._get_camera_prompt(camera_angle)
            if camera_addition:
                enhanced_parts.append(camera_addition)
        
        return ". ".join(filter(None, enhanced_parts))
    
    def _get_valid_size(self, size, model='dall-e-3'):
        """Get valid size for DALL-E model"""
        # DALL-E 3 supported sizes
        dalle3_sizes = ['1024x1024', '1792x1024', '1024x1792']
        # DALL-E 2 supported sizes
        dalle2_sizes = ['256x256', '512x512', '1024x1024']
        
        if model == 'dall-e-3':
            if size in dalle3_sizes:
                return size
            # Map to closest supported size
            width, height = map(int, size.split('x'))
            if width > height:
                return '1792x1024'  # Landscape
            elif height > width:
                return '1024x1792'  # Portrait
            else:
                return '1024x1024'  # Square
        else:  # dall-e-2
            if size in dalle2_sizes:
                return size
            # Map to closest supported size
            width, height = map(int, size.split('x'))
            total = width * height
            if total <= 256*256:
                return '256x256'
            elif total <= 512*512:
                return '512x512'
            else:
                return '1024x1024'
    
    def generate_image(self, prompt, style='realistic', size='1024x1024', quality='standard',
                       negative_prompt=None, lighting=None, camera_angle=None,
                       enhance=True, seed=None, model='dall-e-3'):
        """
        Generate image using OpenAI DALL-E API
        """
        if not self.api_key:
            return {
                'success': False,
                'error': 'OpenAI API key not configured'
            }
        
        start_time = time.time()
        
        try:
            # Enhance prompt if requested
            if enhance:
                final_prompt = self.enhance_prompt(prompt, style, lighting, camera_angle)
            else:
                final_prompt = prompt
            
            # Add negative prompt as "avoid" instruction
            if negative_prompt:
                final_prompt += f". Avoid: {negative_prompt}"
            
            # Get valid size for model
            valid_size = self._get_valid_size(size, model)
            
            # Map quality
            api_quality = 'hd' if quality in ['high', 'hd', 'ultra'] else 'standard'
            
            # Prepare API request
            url = f"{self.base_url}/images/generations"
            
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {self.api_key}'
            }
            
            payload = {
                'model': model,
                'prompt': final_prompt,
                'n': 1,
                'size': valid_size,
                'response_format': 'b64_json'
            }
            
            # DALL-E 3 specific options
            if model == 'dall-e-3':
                payload['quality'] = api_quality
                # Style: 'vivid' or 'natural'
                if style in ['vivid', 'neon', 'cinematic', 'fantasy']:
                    payload['style'] = 'vivid'
                else:
                    payload['style'] = 'natural'
            
            # Make request
            response = requests.post(
                url,
                headers=headers,
                json=payload,
                timeout=120
            )
            
            if response.status_code == 200:
                result = response.json()
                
                if 'data' in result and len(result['data']) > 0:
                    image_data = result['data'][0]
                    image_b64 = image_data.get('b64_json')
                    revised_prompt = image_data.get('revised_prompt', '')
                    
                    if image_b64:
                        image_bytes = base64.b64decode(image_b64)
                        
                        # Resize if original size was different
                        if size != valid_size:
                            target_width, target_height = map(int, size.split('x'))
                            img = Image.open(io.BytesIO(image_bytes))
                            img = img.resize((target_width, target_height), Image.Resampling.LANCZOS)
                            buffer = io.BytesIO()
                            img.save(buffer, format='PNG', quality=95)
                            image_bytes = buffer.getvalue()
                        
                        return {
                            'success': True,
                            'image_data': image_bytes,
                            'enhanced_prompt': final_prompt,
                            'revised_prompt': revised_prompt,
                            'model': model,
                            'size_used': valid_size,
                            'processing_time': time.time() - start_time
                        }
                
                return {
                    'success': False,
                    'error': 'No image data in response',
                    'processing_time': time.time() - start_time
                }
            
            elif response.status_code == 400:
                error_data = response.json()
                error_msg = error_data.get('error', {}).get('message', 'Bad request')
                return {
                    'success': False,
                    'error': f'OpenAI Error: {error_msg}',
                    'processing_time': time.time() - start_time
                }
            
            elif response.status_code == 401:
                return {
                    'success': False,
                    'error': 'Invalid OpenAI API key',
                    'processing_time': time.time() - start_time
                }
            
            elif response.status_code == 429:
                return {
                    'success': False,
                    'error': 'Rate limit exceeded. Please try again later.',
                    'processing_time': time.time() - start_time
                }
            
            else:
                return {
                    'success': False,
                    'error': f'OpenAI API error: {response.status_code}',
                    'processing_time': time.time() - start_time
                }
                
        except requests.exceptions.Timeout:
            return {
                'success': False,
                'error': 'Request timed out. Please try again.',
                'processing_time': time.time() - start_time
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'processing_time': time.time() - start_time
            }
    
    def add_logo_to_image(self, image_data, logo_path, position='bottom_right', 
                          size_percent=10, opacity=100):
        """Add logo watermark to image"""
        try:
            # Open main image
            main_image = Image.open(io.BytesIO(image_data)).convert('RGBA')
            img_width, img_height = main_image.size
            
            # Open and resize logo
            logo = Image.open(logo_path).convert('RGBA')
            
            # Calculate logo size
            size_percent = max(5, min(30, size_percent))
            logo_width = int(img_width * size_percent / 100)
            logo_ratio = logo.width / logo.height
            logo_height = int(logo_width / logo_ratio)
            logo = logo.resize((logo_width, logo_height), Image.Resampling.LANCZOS)
            
            # Apply opacity
            opacity = max(10, min(100, opacity))
            if opacity < 100:
                alpha = logo.split()[3]
                alpha = alpha.point(lambda p: int(p * opacity / 100))
                logo.putalpha(alpha)
            
            # Calculate position
            padding = int(img_width * 0.02)
            
            positions = {
                'top_left': (padding, padding),
                'top_right': (img_width - logo_width - padding, padding),
                'top_center': ((img_width - logo_width) // 2, padding),
                'bottom_left': (padding, img_height - logo_height - padding),
                'bottom_right': (img_width - logo_width - padding, img_height - logo_height - padding),
                'bottom_center': ((img_width - logo_width) // 2, img_height - logo_height - padding),
                'center': ((img_width - logo_width) // 2, (img_height - logo_height) // 2),
            }
            
            pos = positions.get(position, positions['bottom_right'])
            
            # Paste logo onto image
            main_image.paste(logo, pos, logo)
            
            # Convert back to RGB
            if main_image.mode == 'RGBA':
                background = Image.new('RGB', main_image.size, (255, 255, 255))
                background.paste(main_image, mask=main_image.split()[3])
                main_image = background
            
            # Save to bytes
            buffer = io.BytesIO()
            main_image.save(buffer, format='PNG', quality=95)
            return buffer.getvalue()
            
        except Exception as e:
            print(f"Error adding logo: {e}")
            return image_data
    
    def test_api_key(self):
        """Test if the API key is valid"""
        if not self.api_key:
            return {'success': False, 'error': 'No API key provided'}
        
        try:
            # Test with models endpoint
            url = f"{self.base_url}/models"
            
            headers = {
                'Authorization': f'Bearer {self.api_key}'
            }
            
            response = requests.get(url, headers=headers, timeout=15)
            
            if response.status_code == 200:
                return {'success': True, 'message': 'OpenAI API key is valid!'}
            elif response.status_code == 401:
                return {'success': False, 'error': 'Invalid API key'}
            else:
                return {'success': False, 'error': f'Error: {response.status_code}'}
                
        except requests.exceptions.Timeout:
            return {'success': False, 'error': 'Connection timed out'}
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def list_available_models(self):
        """List available DALL-E models"""
        return {
            'success': True,
            'models': [
                {
                    'id': 'dall-e-3',
                    'name': 'DALL-E 3',
                    'description': 'Most capable model with best quality',
                    'sizes': ['1024x1024', '1792x1024', '1024x1792'],
                    'features': ['HD quality', 'Vivid/Natural styles', 'Prompt revision']
                },
                {
                    'id': 'dall-e-2',
                    'name': 'DALL-E 2',
                    'description': 'Faster, more economical option',
                    'sizes': ['256x256', '512x512', '1024x1024'],
                    'features': ['Faster generation', 'Lower cost']
                }
            ]
        }
