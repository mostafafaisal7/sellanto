# ai_video/gemini_service.py

"""
Google Gemini API Service for AI Video Generation
Uses Veo model for text-to-video generation
Install: pip install requests Pillow moviepy
"""

import io
import os
import time
import base64
import tempfile
import requests
from PIL import Image
from django.conf import settings


class GeminiVideoService:
    """
    AI Video Generator using Google Gemini/Veo API
    """
    
    def __init__(self, api_key=None):
        self.api_key = api_key or getattr(settings, 'GEMINI_API_KEY', None)
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"
    
    def _get_style_prompt(self, style):
        """Get style-specific prompt additions"""
        style_prompts = {
            'realistic': "photorealistic, cinematic quality, natural lighting, detailed textures, lifelike",
            'cinematic': "cinematic, movie-like, dramatic lighting, film grain, professional cinematography, widescreen",
            'anime': "anime style, Japanese animation, vibrant colors, expressive, dynamic, 2D animated",
            'cartoon': "cartoon style, animated, colorful, playful, exaggerated expressions, fun",
            '3d_animation': "3D animated, Pixar-style, rendered, smooth animation, CGI quality",
            'artistic': "artistic, creative, painterly, expressive, unique visual style",
            'vintage': "vintage film, retro, nostalgic, old movie aesthetic, film scratches, sepia tones",
            'slow_motion': "slow motion, smooth, detailed motion, time-stretched, cinematic slow-mo",
            'timelapse': "timelapse, accelerated time, smooth transitions, time compression",
            'documentary': "documentary style, realistic, informative, natural, observational",
            'sci_fi': "science fiction, futuristic, high-tech, neon lights, cyberpunk elements",
            'fantasy': "fantasy, magical, ethereal, mystical, enchanting atmosphere",
            'horror': "dark, atmospheric, suspenseful, moody lighting, eerie",
            'comedy': "bright, colorful, fun, energetic, lighthearted",
            'music_video': "music video style, dynamic cuts, rhythmic, visually striking, artistic",
        }
        return style_prompts.get(style, "high quality, smooth motion")
    
    def _get_camera_motion_prompt(self, camera_motion):
        """Get camera motion prompt additions"""
        motion_prompts = {
            'static': "static camera, fixed shot, no camera movement",
            'pan_left': "camera panning left, horizontal movement left",
            'pan_right': "camera panning right, horizontal movement right",
            'tilt_up': "camera tilting up, vertical movement upward",
            'tilt_down': "camera tilting down, vertical movement downward",
            'zoom_in': "camera zooming in, getting closer, push in",
            'zoom_out': "camera zooming out, pulling back, wide reveal",
            'orbit': "camera orbiting, circling around subject, 360 movement",
            'dolly': "dolly shot, camera tracking, smooth forward movement",
            'crane': "crane shot, elevated camera movement, sweeping",
            'handheld': "handheld camera, slight shake, documentary feel",
        }
        return motion_prompts.get(camera_motion, "")
    
    def _get_motion_intensity_prompt(self, intensity):
        """Get motion intensity prompt additions"""
        intensity_prompts = {
            'subtle': "subtle movement, gentle motion, calm",
            'moderate': "moderate movement, balanced motion",
            'dynamic': "dynamic movement, energetic, active",
            'intense': "intense movement, fast-paced, high energy, dramatic action",
        }
        return intensity_prompts.get(intensity, "")
    
    def build_brand_aware_prompt(self, prompt, brand=None, workspace=None):
        """
        Inject BrandDNA and Workspace context into video prompt

        Args:
            prompt: User's original prompt
            brand: Brand model instance (optional)
            workspace: Workspace model instance (optional)

        Returns:
            Enhanced prompt with brand context
        """
        enhanced = prompt

        if brand:
            # Extract BrandDNA
            brand_dna = brand.brand_dna or {}
            voice_tone = brand.voice_tone or 'professional'
            industry = brand.industry or ''

            # Build brand context
            brand_context = f"\n\n🎨 Brand Context: {brand.brand_name}"

            if industry:
                brand_context += f" ({industry} industry)"

            brand_context += f"\n• Voice & Tone: {voice_tone}"

            # Add visual style from BrandDNA
            if 'visual_style' in brand_dna:
                brand_context += f"\n• Visual Style: {brand_dna['visual_style']}"

            # Add color palette (key for brand consistency)
            if 'color_palette' in brand_dna and brand_dna['color_palette']:
                colors = ', '.join(brand_dna['color_palette'][:3])
                brand_context += f"\n• Brand Colors: {colors}"
            elif 'primary_color' in brand_dna:
                brand_context += f"\n• Primary Color: {brand_dna['primary_color']}"

            # Add mood/aesthetic
            if 'mood' in brand_dna:
                brand_context += f"\n• Mood: {brand_dna['mood']}"

            enhanced += brand_context

        if workspace:
            enhanced += f"\n\n🏢 Workspace: {workspace.name}"

        return enhanced

    def enhance_prompt(self, prompt, style='realistic', camera_motion=None, motion_intensity=None, brand=None, workspace=None):
        """Enhance user prompt with style, technical details, and BrandDNA"""

        # First, add BrandDNA context if available
        if brand or workspace:
            prompt = self.build_brand_aware_prompt(prompt, brand=brand, workspace=workspace)

        # Then add style and technical details
        style_addition = self._get_style_prompt(style) or ''
        motion_addition = self._get_camera_motion_prompt(camera_motion) if camera_motion else ''
        intensity_addition = self._get_motion_intensity_prompt(motion_intensity) if motion_intensity else ''

        enhanced = f"""{prompt}.

Visual style: {style_addition}.
{f'Camera movement: {motion_addition}.' if motion_addition else ''}
{f'Motion intensity: {intensity_addition}.' if intensity_addition else ''}

Additional guidance: Ensure smooth transitions, consistent lighting throughout the sequence, and natural motion that serves the narrative. The video should feel intentional and professionally directed, not randomly generated."""

        return enhanced
    
    # Image-to-video requires Veo 3.x; text-only works on Veo 2.0+
    VEO_IMAGE_MODELS = [
        'veo-3.1-generate-preview',
    ]
    VEO_TEXT_MODELS = [
        'veo-3.1-generate-preview',
        'veo-2.0-generate-001',
    ]

    def generate_video(self, prompt, style='realistic', duration=5, resolution='1080p',
                       aspect_ratio='16:9', fps=30, negative_prompt=None,
                       camera_motion=None, motion_intensity=None, enhance=True, seed=None,
                       reference_image=None, brand=None, workspace=None):
        """
        Generate video using Gemini/Veo API with BrandDNA integration
        """
        if not self.api_key:
            return {
                'success': False,
                'error': 'Gemini API key not configured'
            }

        start_time = time.time()

        try:
            # Enhance prompt if requested (includes BrandDNA injection)
            if enhance:
                final_prompt = self.enhance_prompt(prompt, style, camera_motion, motion_intensity, brand=brand, workspace=workspace)
            else:
                final_prompt = prompt

            # Add negative prompt
            if negative_prompt:
                final_prompt += f". Avoid: {negative_prompt}"

            # Pick model list: image-to-video needs Veo 3.x
            models_to_try = self.VEO_IMAGE_MODELS if reference_image else self.VEO_TEXT_MODELS

            last_error = None
            for model in models_to_try:
                result = self._generate_with_veo(
                    final_prompt, duration, resolution, aspect_ratio,
                    reference_image=reference_image, model=model,
                )
                if result.get('success'):
                    result['enhanced_prompt'] = final_prompt
                    result['processing_time'] = time.time() - start_time
                    result['model_used'] = model
                    return result
                last_error = result.get('error', '')

            return {
                'success': False,
                'error': last_error or 'Video generation failed. This feature may not be available in your region yet.',
                'processing_time': time.time() - start_time,
            }

        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'processing_time': time.time() - start_time
            }
    
    def _generate_with_veo(self, prompt, duration, resolution, aspect_ratio,
                           reference_image=None, model='veo-2.0-generate-001'):
        """Generate using Veo model via predictLongRunning endpoint.

        Image-to-video (reference_image) is only supported on Veo 3.x models.
        """
        try:
            url = f"{self.base_url}/models/{model}:predictLongRunning"

            headers = {
                'Content-Type': 'application/json',
                'x-goog-api-key': self.api_key,
            }

            is_veo3 = 'veo-3' in model

            # Build instance with optional reference image (Veo 3.x only)
            instance = {'prompt': prompt}
            if reference_image and is_veo3:
                # Detect MIME type from first bytes
                mime = 'image/png'
                if reference_image[:3] == b'\xff\xd8\xff':
                    mime = 'image/jpeg'
                elif reference_image[:4] == b'RIFF':
                    mime = 'image/webp'

                instance['image'] = {
                    'inlineData': {
                        'data': base64.b64encode(reference_image).decode(),
                        'mimeType': mime,
                    }
                }

            params = {
                'aspectRatio': aspect_ratio,
                'personGeneration': 'allow_adult',
                'sampleCount': 1,
            }
            if resolution in ('720p', '1080p', '4k'):
                params['resolution'] = resolution

            payload = {
                'instances': [instance],
                'parameters': params,
            }

            response = requests.post(
                url,
                headers=headers,
                json=payload,
                timeout=300,
            )

            if response.status_code == 200:
                result = response.json()

                # Veo always returns a long-running operation
                if 'name' in result:
                    return self._poll_operation(result['name'])

                return {'success': False, 'error': 'Unexpected response format'}
            else:
                error_msg = f"API Error: {response.status_code}"
                try:
                    error_data = response.json()
                    if 'error' in error_data:
                        error_msg = error_data['error'].get('message', error_msg)
                except Exception:
                    pass
                return {'success': False, 'error': error_msg}

        except requests.exceptions.Timeout:
            return {'success': False, 'error': 'Request timed out'}
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def _poll_operation(self, operation_name, max_attempts=60, interval=10):
        """Poll a long-running operation for completion.

        Veo returns ``generateVideoResponse.generatedSamples[].video.uri``
        which must be downloaded with the API key header.
        """
        try:
            url = f"{self.base_url}/{operation_name}"
            headers = {'x-goog-api-key': self.api_key}

            for attempt in range(max_attempts):
                response = requests.get(url, headers=headers, timeout=30)

                if response.status_code != 200:
                    return {'success': False, 'error': f'Poll failed: {response.status_code}'}

                result = response.json()

                if not result.get('done'):
                    time.sleep(interval)
                    continue

                # Check for error
                if 'error' in result:
                    return {'success': False, 'error': result['error'].get('message', 'Operation failed')}

                # Extract video URI from response
                resp = result.get('response', {})
                video_uri = None

                # Format 1: generateVideoResponse (Veo API)
                gen_resp = resp.get('generateVideoResponse', {})
                samples = gen_resp.get('generatedSamples', [])
                if samples:
                    video_uri = samples[0].get('video', {}).get('uri')

                # Format 2: legacy predictions (older API versions)
                if not video_uri and 'predictions' in resp:
                    for pred in resp['predictions']:
                        if 'bytesBase64Encoded' in pred:
                            video_data = base64.b64decode(pred['bytesBase64Encoded'])
                            return {
                                'success': True,
                                'video_data': video_data,
                                'format': 'mp4',
                            }

                if video_uri:
                    # Download the video from the URI
                    video_data = self._download_video(video_uri)
                    if video_data:
                        return {
                            'success': True,
                            'video_data': video_data,
                            'format': 'mp4',
                        }
                    return {'success': False, 'error': 'Failed to download generated video'}

                return {'success': False, 'error': 'No video in completed operation'}

            return {'success': False, 'error': 'Operation timed out (10 minutes)'}

        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _download_video(self, uri):
        """Download video bytes from a Veo-returned URI."""
        try:
            headers = {'x-goog-api-key': self.api_key}
            resp = requests.get(uri, headers=headers, timeout=120)
            if resp.status_code == 200:
                return resp.content
            # Some URIs don't need auth
            resp2 = requests.get(uri, timeout=120)
            if resp2.status_code == 200:
                return resp2.content
            return None
        except Exception:
            return None
    
    def add_logo_to_video(self, video_path, logo_path, output_path, position='bottom_right',
                          size_percent=10, opacity=100):
        """
        Add logo watermark to video using moviepy
        """
        try:
            from moviepy.editor import VideoFileClip, ImageClip, CompositeVideoClip
            
            # Load video
            video = VideoFileClip(video_path)
            video_width, video_height = video.size
            
            # Load and resize logo
            logo = Image.open(logo_path).convert('RGBA')
            
            # Calculate logo size
            size_percent = max(5, min(25, size_percent))
            logo_width = int(video_width * size_percent / 100)
            logo_ratio = logo.width / logo.height
            logo_height = int(logo_width / logo_ratio)
            logo = logo.resize((logo_width, logo_height), Image.Resampling.LANCZOS)
            
            # Apply opacity
            if opacity < 100:
                alpha = logo.split()[3]
                alpha = alpha.point(lambda p: int(p * opacity / 100))
                logo.putalpha(alpha)
            
            # Save logo temporarily
            temp_logo = tempfile.NamedTemporaryFile(suffix='.png', delete=False)
            logo.save(temp_logo.name)
            
            # Calculate position
            padding = int(video_width * 0.02)
            
            positions = {
                'top_left': (padding, padding),
                'top_right': (video_width - logo_width - padding, padding),
                'top_center': ((video_width - logo_width) // 2, padding),
                'bottom_left': (padding, video_height - logo_height - padding),
                'bottom_right': (video_width - logo_width - padding, video_height - logo_height - padding),
                'bottom_center': ((video_width - logo_width) // 2, video_height - logo_height - padding),
                'center': ((video_width - logo_width) // 2, (video_height - logo_height) // 2),
            }
            
            pos = positions.get(position, positions['bottom_right'])
            
            # Create logo clip
            logo_clip = (ImageClip(temp_logo.name)
                        .set_duration(video.duration)
                        .set_position(pos))
            
            # Composite video with logo
            final_video = CompositeVideoClip([video, logo_clip])
            
            # Write output
            final_video.write_videofile(
                output_path,
                codec='libx264',
                audio_codec='aac',
                temp_audiofile='temp-audio.m4a',
                remove_temp=True,
                verbose=False,
                logger=None
            )
            
            # Cleanup
            video.close()
            final_video.close()
            os.unlink(temp_logo.name)
            
            return True
            
        except ImportError:
            print("moviepy not installed. Run: pip install moviepy")
            return False
        except Exception as e:
            print(f"Error adding logo to video: {e}")
            return False
    
    def generate_thumbnail(self, video_path, output_path, time_offset=0):
        """Generate thumbnail from video"""
        try:
            from moviepy.editor import VideoFileClip
            
            video = VideoFileClip(video_path)
            
            # Get frame at specified time or middle
            if time_offset == 0:
                time_offset = video.duration / 2
            
            frame = video.get_frame(min(time_offset, video.duration - 0.1))
            
            # Convert to PIL Image and save
            img = Image.fromarray(frame)
            img.save(output_path, quality=90)
            
            video.close()
            return True
            
        except ImportError:
            print("moviepy not installed")
            return False
        except Exception as e:
            print(f"Error generating thumbnail: {e}")
            return False
    
    def test_api_key(self):
        """Test if the API key is valid"""
        if not self.api_key:
            return {'success': False, 'error': 'No API key provided'}
        
        try:
            # Test with text generation
            url = f"{self.base_url}/models/gemini-2.0-flash:generateContent"
            
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
            else:
                return {'success': False, 'error': f'Error: {response.status_code}'}
                
        except requests.exceptions.Timeout:
            return {'success': False, 'error': 'Connection timed out'}
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def list_video_models(self):
        """List available video models"""
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
                    # Filter for video-related models
                    if any(x in name.lower() for x in ['video', 'veo', 'generate']):
                        models.append({
                            'name': name,
                            'displayName': model.get('displayName', ''),
                            'description': model.get('description', ''),
                        })
                
                return {'success': True, 'models': models}
            else:
                return {'success': False, 'error': f'Error: {response.status_code}'}
                
        except Exception as e:
            return {'success': False, 'error': str(e)}
