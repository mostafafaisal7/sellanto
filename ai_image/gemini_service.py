# ai_image/gemini_service.py

"""
Google Gemini API Service for AI Image Generation
Uses requests library - NO SDK needed
Install: pip install requests Pillow
"""

import io
import time
import base64
import urllib.parse
import requests
from PIL import Image
from django.conf import settings


class GeminiImageService:
    """
    AI Image Generator using Google Gemini API (REST)
    No SDK required - uses requests only
    """
    
    def __init__(self, api_key=None):
        self.api_key = api_key or getattr(settings, 'GEMINI_API_KEY', None)
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"
    
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
        style_addition = self._get_style_prompt(style) or ''
        lighting_addition = self._get_lighting_prompt(lighting) if lighting else ''
        camera_addition = self._get_camera_prompt(camera_angle) if camera_angle else ''

        enhanced = f"""{prompt}.

Visual style: {style_addition}.
{f'Lighting: {lighting_addition}.' if lighting_addition else ''}
{f'Camera angle: {camera_addition}.' if camera_addition else ''}

Ensure professional quality with clear composition, consistent lighting, and a cohesive visual mood throughout."""

        return enhanced
    
    def generate_image(self, prompt, style='realistic', size='1024x1024', quality='high',
                       negative_prompt=None, lighting=None, camera_angle=None,
                       enhance=True, seed=None):
        """
        Generate image using Gemini API
        """
        if not self.api_key:
            return {
                'success': False,
                'error': 'Gemini API key not configured'
            }
        
        start_time = time.time()
        
        try:
            # Enhance prompt if requested
            if enhance:
                final_prompt = self.enhance_prompt(prompt, style, lighting, camera_angle)
            else:
                final_prompt = prompt
            
            # Add negative prompt
            if negative_prompt:
                final_prompt += f"\nDo not include: {negative_prompt}"
            
            # Parse size
            width, height = map(int, size.split('x'))
            
            # 1st choice: Imagen 4 Ultra — most powerful confirmed model for this key
            imagen_result = self._generate_with_imagen(final_prompt, width, height)
            if imagen_result.get('success'):
                imagen_result['enhanced_prompt'] = final_prompt
                imagen_result['processing_time'] = time.time() - start_time
                return imagen_result

            imagen_error = imagen_result.get('error', 'Imagen failed')

            # 2nd choice: Gemini Flash image models (pro → flash → lite)
            flash_result = self._generate_with_gemini_flash(final_prompt, width, height)
            if flash_result.get('success'):
                flash_result['enhanced_prompt'] = final_prompt
                flash_result['processing_time'] = time.time() - start_time
                return flash_result

            gemini_error = flash_result.get('error', 'Gemini image generation failed')

            # 3rd choice: Pollinations.ai (FLUX model, free, no API key needed)
            pollinations_result = self._generate_with_pollinations(final_prompt, width, height)
            if pollinations_result.get('success'):
                pollinations_result['enhanced_prompt'] = final_prompt
                pollinations_result['processing_time'] = time.time() - start_time
                return pollinations_result

            pollinations_error = pollinations_result.get('error', 'Pollinations failed')

            return {
                'success': False,
                'error': f'Imagen: {imagen_error} | Gemini: {gemini_error} | Pollinations: {pollinations_error}',
                'processing_time': time.time() - start_time
            }
                
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'processing_time': time.time() - start_time
            }
    
    def _extract_api_error(self, response):
        """Read the error message from an API error response."""
        try:
            data = response.json()
            if 'error' in data:
                return data['error'].get('message', '') or data['error'].get('status', '')
        except Exception:
            pass
        return ''

    def _generate_with_gemini_flash(self, prompt, width, height):
        """Generate using Gemini Flash with image output (tries multiple models)."""
        # Gemini image models — ordered by quality (pro > flash > lite).
        # Used as fallback after Imagen 4 Ultra.
        candidates = [
            (
                'gemini-3-pro-image',
                {
                    'contents': [{'parts': [{'text': prompt}]}],
                    'generationConfig': {'responseModalities': ['IMAGE'], 'temperature': 1.0},
                },
            ),
            (
                'gemini-3.1-flash-image',
                {
                    'contents': [{'parts': [{'text': prompt}]}],
                    'generationConfig': {'responseModalities': ['IMAGE'], 'temperature': 1.0},
                },
            ),
            (
                'gemini-2.5-flash-image',
                {
                    'contents': [{'parts': [{'text': prompt}]}],
                    'generationConfig': {'responseModalities': ['IMAGE'], 'temperature': 1.0},
                },
            ),
        ]

        errors = []  # collect per-model errors for diagnostics

        for model_name, payload in candidates:
            try:
                url = f"{self.base_url}/models/{model_name}:generateContent"

                response = requests.post(
                    f"{url}?key={self.api_key}",
                    headers={'Content-Type': 'application/json'},
                    json=payload,
                    timeout=120
                )

                if response.status_code == 200:
                    result = response.json()
                    for candidate in result.get('candidates', []):
                        for part in candidate.get('content', {}).get('parts', []):
                            if 'inlineData' in part:
                                inline_data = part['inlineData']
                                if inline_data.get('mimeType', '').startswith('image/'):
                                    image_b64 = inline_data.get('data', '')
                                    if image_b64:
                                        image_data = base64.b64decode(image_b64)
                                        img = Image.open(io.BytesIO(image_data))
                                        if img.size != (width, height):
                                            img = img.resize((width, height), Image.Resampling.LANCZOS)
                                            buf = io.BytesIO()
                                            img.save(buf, format='PNG', quality=95)
                                            image_data = buf.getvalue()
                                        return {
                                            'success': True,
                                            'image_data': image_data,
                                            'model_used': model_name,
                                        }
                    errors.append(f'{model_name}: no image part in response')
                    continue

                api_msg = self._extract_api_error(response)
                if response.status_code == 404:
                    detail = f' ({api_msg})' if api_msg else ''
                    errors.append(f'{model_name}: not found (404){detail}')
                elif response.status_code == 400:
                    errors.append(f'{model_name}: bad request — {api_msg or response.status_code}')
                elif response.status_code == 403:
                    errors.append(f'{model_name}: permission denied — {api_msg or "check API key"}')
                else:
                    errors.append(f'{model_name}: HTTP {response.status_code} — {api_msg or "unknown error"}')

            except requests.exceptions.Timeout:
                errors.append(f'{model_name}: request timed out')
            except Exception as e:
                errors.append(f'{model_name}: {e}')

        combined = '; '.join(errors) if errors else 'All Gemini image models failed'
        return {'success': False, 'error': f'Gemini image generation failed: {combined}'}

    def _generate_with_pollinations(self, prompt, width, height):
        """
        Free fallback: Pollinations.ai (FLUX model, no API key required).
        Returns image bytes on success.
        """
        try:
            # Keep prompt short — long URLs cause 414/connection issues.
            # Take only the first meaningful sentence/line.
            short_prompt = prompt.strip()
            # Strip the "enhance_prompt" boilerplate that gets appended
            if '\n\nVisual style:' in short_prompt:
                short_prompt = short_prompt.split('\n\nVisual style:')[0]
            short_prompt = short_prompt[:300]

            safe_prompt = urllib.parse.quote(short_prompt, safe='')
            url = (
                f"https://image.pollinations.ai/prompt/{safe_prompt}"
                f"?width={width}&height={height}&model=flux&nologo=true&seed=42"
            )
            response = requests.get(url, timeout=90)

            if response.status_code != 200 or not response.content:
                return {
                    'success': False,
                    'error': f'Pollinations HTTP {response.status_code}',
                }

            img = Image.open(io.BytesIO(response.content))
            if img.mode not in ('RGB', 'RGBA'):
                img = img.convert('RGB')
            if img.size != (width, height):
                img = img.resize((width, height), Image.Resampling.LANCZOS)

            buf = io.BytesIO()
            img.convert('RGB').save(buf, format='PNG', quality=95)

            return {
                'success': True,
                'image_data': buf.getvalue(),
                'model_used': 'pollinations-flux',
            }

        except Exception as e:
            return {'success': False, 'error': f'Pollinations error: {e}'}
    
    def _generate_with_imagen(self, prompt, width, height):
        """Generate using Imagen API"""
        try:
            # Determine aspect ratio
            ratio = width / height
            if abs(ratio - 1.0) < 0.1:
                aspect = "1:1"
            elif ratio > 1.2:
                aspect = "16:9"
            else:
                aspect = "9:16"
            
            # Imagen 4 Ultra is the most powerful — confirmed available for this key
            models = [
                'imagen-4.0-ultra-generate-001',
                'imagen-4.0-generate-001',
            ]
            
            for model in models:
                url = f"{self.base_url}/models/{model}:predict"
                
                headers = {
                    'Content-Type': 'application/json',
                }
                
                payload = {
                    'instances': [{'prompt': prompt}],
                    'parameters': {
                        'sampleCount': 1,
                        'aspectRatio': aspect,
                        'safetyFilterLevel': 'block_only_high',
                    }
                }
                
                response = requests.post(
                    f"{url}?key={self.api_key}",
                    headers=headers,
                    json=payload,
                    timeout=120
                )
                
                if response.status_code == 200:
                    result = response.json()
                    
                    if 'predictions' in result and len(result['predictions']) > 0:
                        prediction = result['predictions'][0]
                        image_b64 = prediction.get('bytesBase64Encoded')
                        
                        if image_b64:
                            image_data = base64.b64decode(image_b64)
                            
                            # Resize if needed
                            img = Image.open(io.BytesIO(image_data))
                            if img.size != (width, height):
                                img = img.resize((width, height), Image.Resampling.LANCZOS)
                                buffer = io.BytesIO()
                                img.save(buffer, format='PNG', quality=95)
                                image_data = buffer.getvalue()
                            
                            return {
                                'success': True,
                                'image_data': image_data
                            }
            
            return {'success': False, 'error': 'Imagen model not available. This may be due to: 1) Invalid Gemini API key, 2) Imagen not available in your region, or 3) API quota exceeded. Try using OpenAI instead.'}
                
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
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
            # Simple test with text generation
            url = f"{self.base_url}/models/gemini-2.5-flash:generateContent"
            
            headers = {
                'Content-Type': 'application/json',
            }
            
            payload = {
                'contents': [{
                    'parts': [{
                        'text': 'Say "API key is working" in exactly those words.'
                    }]
                }]
            }
            
            response = requests.post(
                f"{url}?key={self.api_key}",
                headers=headers,
                json=payload,
                timeout=15
            )
            
            if response.status_code == 200:
                return {'success': True, 'message': 'API key is valid and working!'}
            elif response.status_code == 400:
                error_data = response.json()
                error_msg = error_data.get('error', {}).get('message', 'Invalid request')
                if 'API_KEY' in error_msg.upper():
                    return {'success': False, 'error': 'Invalid API key'}
                return {'success': False, 'error': error_msg}
            elif response.status_code == 403:
                return {'success': False, 'error': 'API key does not have permission'}
            else:
                return {'success': False, 'error': f'Error: {response.status_code}'}
                
        except requests.exceptions.Timeout:
            return {'success': False, 'error': 'Connection timed out'}
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def list_available_models(self):
        """List available models"""
        if not self.api_key:
            return {'success': False, 'error': 'No API key'}
        
        try:
            url = f"{self.base_url}/models"
            
            response = requests.get(
                f"{url}?key={self.api_key}",
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                models = []
                
                for model in data.get('models', []):
                    name = model.get('name', '')
                    # Filter for image-related models
                    if any(x in name.lower() for x in ['image', 'imagen', 'vision']):
                        models.append({
                            'name': name,
                            'displayName': model.get('displayName', ''),
                            'description': model.get('description', ''),
                        })
                
                return {'success': True, 'models': models, 'total': len(data.get('models', []))}
            else:
                return {'success': False, 'error': f'Error: {response.status_code}'}
                
        except Exception as e:
            return {'success': False, 'error': str(e)}