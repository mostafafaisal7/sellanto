# video_studio/services/veo_service.py

"""
Google Veo 3.1 AI Video Generation Service
Complete wrapper for Veo API with image-to-video support
"""

import base64
import time
import requests
import io
from django.conf import settings
from django.core.files.base import ContentFile
from PIL import Image


class VeoVideoService:
    """
    Complete Google Veo API wrapper for SaleAnto Video Studio
    Supports text-to-video, image-to-video, and video extension
    """

    def __init__(self, api_key=None):
        self.api_key = api_key or getattr(settings, 'GEMINI_API_KEY', None)
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"

        # Model selection with pricing
        self.MODELS = {
            'premium': {
                'name': 'veo-3.1-generate-preview',
                'cost_per_second': 0.40,
                'quality': 'highest',
                'speed': 'slow'
            },
            'standard': {
                'name': 'veo-3.1-lite-generate-preview',
                'cost_per_second': 0.25,
                'quality': 'high',
                'speed': 'medium'
            },
            'fast': {
                'name': 'veo-3.1-fast',
                'cost_per_second': 0.15,
                'quality': 'good',
                'speed': 'fast'
            },
        }

        # Fallback models
        self.FALLBACK_MODELS = [
            'veo-2.0-generate-001',
            'veo-2.0-generate-preview',
        ]

    def generate_video(
        self,
        prompt,
        reference_image=None,
        duration=8,
        aspect_ratio='16:9',
        resolution='1080p',
        model_tier='standard',
        seed=None,
        generate_audio=True,
        camera_movement=None,
        lighting_style=None
    ):
        """
        Generate video using Veo API

        Args:
            prompt (str): Text description of desired video
            reference_image (bytes): Product image data for image-to-video (optional)
            duration (int): Video length in seconds (currently fixed at 8)
            aspect_ratio (str): '16:9', '9:16', or '1:1'
            resolution (str): '720p', '1080p', or '4k'
            model_tier (str): 'premium', 'standard', or 'fast'
            seed (int): Optional seed for reproducibility
            generate_audio (bool): Include audio in output
            camera_movement (str): Specific camera movement instruction
            lighting_style (str): Lighting guidance

        Returns:
            dict: {
                'success': bool,
                'video_data': bytes,
                'duration': int,
                'model_used': str,
                'cost': float,
                'processing_time': float,
                'error': str (if failed)
            }
        """
        if not self.api_key:
            return {
                'success': False,
                'error': 'Gemini API key not configured. Please set GEMINI_API_KEY in settings.'
            }

        start_time = time.time()

        try:
            # Enhance prompt with camera and lighting if provided
            final_prompt = self._enhance_prompt_with_technical_details(
                prompt, camera_movement, lighting_style
            )

            # Select model
            model_info = self.MODELS.get(model_tier, self.MODELS['standard'])
            model_name = model_info['name']

            # Build request payload
            payload = self._build_payload(
                prompt=final_prompt,
                reference_image=reference_image,
                aspect_ratio=aspect_ratio,
                resolution=resolution,
                generate_audio=generate_audio,
                seed=seed
            )

            # Submit generation request
            operation_name = self._submit_generation(model_name, payload)

            if not operation_name:
                # Try fallback models
                for fallback_model in self.FALLBACK_MODELS:
                    operation_name = self._submit_generation(fallback_model, payload)
                    if operation_name:
                        model_name = fallback_model
                        break

                if not operation_name:
                    return {
                        'success': False,
                        'error': 'Failed to submit generation request to Veo API'
                    }

            # Poll for completion (max 10 minutes)
            result = self._poll_operation(operation_name, max_wait=600)

            if result['success']:
                # Calculate cost
                cost = self._calculate_cost(duration, model_tier, generate_audio)

                result.update({
                    'model_used': model_name,
                    'processing_time': time.time() - start_time,
                    'cost': cost,
                    'duration': duration
                })

                return result

            return result

        except Exception as e:
            return {
                'success': False,
                'error': f'Unexpected error: {str(e)}',
                'processing_time': time.time() - start_time
            }

    def _enhance_prompt_with_technical_details(self, prompt, camera_movement, lighting):
        """Add camera and lighting details to prompt if provided"""
        enhanced = prompt

        if camera_movement:
            enhanced += f"\n\nCamera Movement: {camera_movement}"

        if lighting:
            enhanced += f"\nLighting: {lighting}"

        return enhanced

    def _build_payload(self, prompt, reference_image, aspect_ratio, resolution, generate_audio, seed):
        """
        Build Veo API request payload

        Returns:
            dict: Complete API payload
        """
        # Build instance
        instance = {
            'prompt': prompt
        }

        # Add reference image if provided (for image-to-video)
        if reference_image:
            mime_type = self._detect_mime_type(reference_image)

            # Ensure image is bytes
            if not isinstance(reference_image, bytes):
                # If it's a file path
                with open(reference_image, 'rb') as f:
                    reference_image = f.read()

            instance['image'] = {
                'inlineData': {
                    'data': base64.b64encode(reference_image).decode('utf-8'),
                    'mimeType': mime_type
                }
            }

        # Build parameters
        parameters = {
            'aspectRatio': aspect_ratio,
            'resolution': resolution,
            'sampleCount': 1,
            'generateAudio': generate_audio
        }

        if seed:
            parameters['seed'] = seed

        return {
            'instances': [instance],
            'parameters': parameters
        }

    def _submit_generation(self, model, payload):
        """
        Submit generation request to Veo API

        Returns:
            str: Operation name for polling, or None if failed
        """
        url = f"{self.base_url}/models/{model}:predictLongRunning"

        headers = {
            'Content-Type': 'application/json',
            'x-goog-api-key': self.api_key
        }

        try:
            response = requests.post(url, headers=headers, json=payload, timeout=60)

            if response.status_code == 200:
                data = response.json()
                return data.get('name')
            else:
                error_msg = f"Veo API Error: {response.status_code}"
                try:
                    error_data = response.json()
                    if 'error' in error_data:
                        error_msg = error_data['error'].get('message', error_msg)
                except:
                    error_msg = response.text

                print(f"Failed to submit to {model}: {error_msg}")
                return None

        except requests.exceptions.Timeout:
            print(f"Request timeout for {model}")
            return None
        except Exception as e:
            print(f"Failed to submit generation to {model}: {e}")
            return None

    def _poll_operation(self, operation_name, max_wait=600):
        """
        Poll long-running operation until complete

        Args:
            operation_name (str): Operation ID from submission
            max_wait (int): Maximum seconds to wait

        Returns:
            dict: {
                'success': bool,
                'video_data': bytes,
                'error': str (if failed)
            }
        """
        url = f"{self.base_url}/{operation_name}"
        headers = {
            'x-goog-api-key': self.api_key
        }

        elapsed = 0
        interval = 10  # Poll every 10 seconds
        last_log = 0

        while elapsed < max_wait:
            try:
                response = requests.get(url, headers=headers, timeout=30)

                if response.status_code != 200:
                    return {
                        'success': False,
                        'error': f'Poll failed with status {response.status_code}'
                    }

                result = response.json()

                # Log progress every 30 seconds
                if elapsed - last_log >= 30:
                    print(f"Veo generation in progress... ({elapsed}s elapsed)")
                    last_log = elapsed

                # Check if complete
                if not result.get('done'):
                    time.sleep(interval)
                    elapsed += interval
                    continue

                # Check for errors
                if 'error' in result:
                    error_msg = result['error'].get('message', 'Unknown error')
                    return {
                        'success': False,
                        'error': f'Veo generation failed: {error_msg}'
                    }

                # Extract video
                video_uri = self._extract_video_uri(result)

                if video_uri:
                    if isinstance(video_uri, bytes):
                        # Video data is inline
                        return {
                            'success': True,
                            'video_data': video_uri
                        }
                    else:
                        # Download from URI
                        video_data = self._download_video(video_uri)
                        if video_data:
                            return {
                                'success': True,
                                'video_data': video_data
                            }
                        return {
                            'success': False,
                            'error': 'Failed to download video from URI'
                        }

                return {
                    'success': False,
                    'error': 'No video found in completed operation'
                }

            except requests.exceptions.Timeout:
                return {
                    'success': False,
                    'error': 'Polling request timed out'
                }
            except Exception as e:
                return {
                    'success': False,
                    'error': f'Polling error: {str(e)}'
                }

        return {
            'success': False,
            'error': f'Operation timed out after {max_wait} seconds'
        }

    def _extract_video_uri(self, result):
        """
        Extract video URI or data from Veo response

        Returns:
            str or bytes: Video URI or inline video data
        """
        response = result.get('response', {})

        # Try generateVideoResponse format (Veo 3.x)
        gen_resp = response.get('generateVideoResponse', {})
        samples = gen_resp.get('generatedSamples', [])

        if samples and len(samples) > 0:
            video_info = samples[0].get('video', {})
            if 'uri' in video_info:
                return video_info['uri']

        # Try predictions format (Veo 2.x)
        predictions = response.get('predictions', [])
        if predictions and len(predictions) > 0:
            prediction = predictions[0]

            # Check for inline base64
            if 'bytesBase64Encoded' in prediction:
                video_b64 = prediction['bytesBase64Encoded']
                return base64.b64decode(video_b64)

            # Check for video URI
            if 'videoUri' in prediction:
                return prediction['videoUri']

        return None

    def _download_video(self, uri):
        """
        Download video from Veo-provided URI

        Args:
            uri (str): Video download URL

        Returns:
            bytes: Video file data
        """
        # If already bytes, return
        if isinstance(uri, bytes):
            return uri

        try:
            # Try with auth header first
            headers = {
                'x-goog-api-key': self.api_key
            }
            response = requests.get(uri, headers=headers, timeout=120, stream=True)

            if response.status_code == 200:
                return response.content

            # Try without auth (some URIs are pre-signed)
            response = requests.get(uri, timeout=120, stream=True)
            if response.status_code == 200:
                return response.content

            print(f"Failed to download video: HTTP {response.status_code}")
            return None

        except Exception as e:
            print(f"Failed to download video: {e}")
            return None

    def _detect_mime_type(self, image_bytes):
        """
        Detect image MIME type from bytes

        Args:
            image_bytes (bytes): Image file data

        Returns:
            str: MIME type
        """
        if not isinstance(image_bytes, bytes):
            return 'image/jpeg'

        # Check magic bytes
        if image_bytes[:3] == b'\xff\xd8\xff':
            return 'image/jpeg'
        elif image_bytes[:4] == b'\x89PNG':
            return 'image/png'
        elif image_bytes[:4] == b'RIFF' and image_bytes[8:12] == b'WEBP':
            return 'image/webp'
        elif image_bytes[:2] == b'GIF':
            return 'image/gif'
        else:
            return 'image/jpeg'  # Default

    def _calculate_cost(self, duration, model_tier, has_audio):
        """
        Calculate generation cost in USD

        Args:
            duration (int): Video duration in seconds
            model_tier (str): 'premium', 'standard', or 'fast'
            has_audio (bool): Whether audio is included

        Returns:
            float: Cost in USD
        """
        model_info = self.MODELS.get(model_tier, self.MODELS['standard'])
        cost_per_sec = model_info['cost_per_second']

        # Veo includes audio in base price
        total_cost = duration * cost_per_sec

        return round(total_cost, 2)

    # Extension methods

    def extend_video(self, previous_video_path, continuation_prompt, **kwargs):
        """
        Extend existing video with new 8-second clip
        Uses last frame of previous video as reference

        Args:
            previous_video_path (str): Path to previous video file
            continuation_prompt (str): Prompt for continuation
            **kwargs: Additional parameters for generate_video

        Returns:
            dict: Same as generate_video
        """
        try:
            # Extract last frame from video
            last_frame = self._extract_last_frame(previous_video_path)

            # Generate continuation using last frame as reference
            return self.generate_video(
                prompt=continuation_prompt,
                reference_image=last_frame,
                **kwargs
            )

        except Exception as e:
            return {
                'success': False,
                'error': f'Failed to extend video: {str(e)}'
            }

    def _extract_last_frame(self, video_path):
        """
        Extract last frame from video as JPEG bytes

        Args:
            video_path (str): Path to video file

        Returns:
            bytes: JPEG image data of last frame
        """
        try:
            from moviepy.editor import VideoFileClip

            clip = VideoFileClip(video_path)
            last_frame_time = clip.duration - 0.1  # 100ms before end

            # Get frame
            frame = clip.get_frame(last_frame_time)

            # Convert to PIL Image
            img = Image.fromarray(frame)

            # Save to bytes
            buffer = io.BytesIO()
            img.save(buffer, format='JPEG', quality=95)

            clip.close()

            return buffer.getvalue()

        except Exception as e:
            print(f"Failed to extract last frame: {e}")
            return None

    def generate_with_frame_control(self, start_frame, end_frame, prompt, **kwargs):
        """
        Generate video from start frame to end frame
        (Veo 3.1 advanced feature)

        Args:
            start_frame (bytes): Starting frame image data
            end_frame (bytes): Ending frame image data
            prompt (str): Description of desired transition
            **kwargs: Additional parameters

        Returns:
            dict: Same as generate_video
        """
        model_name = self.MODELS['premium']['name']  # Frame control requires premium

        payload = {
            'instances': [{
                'prompt': prompt,
                'firstFrame': {
                    'inlineData': {
                        'data': base64.b64encode(start_frame).decode('utf-8'),
                        'mimeType': self._detect_mime_type(start_frame)
                    }
                },
                'lastFrame': {
                    'inlineData': {
                        'data': base64.b64encode(end_frame).decode('utf-8'),
                        'mimeType': self._detect_mime_type(end_frame)
                    }
                }
            }],
            'parameters': {
                'aspectRatio': kwargs.get('aspect_ratio', '16:9'),
                'resolution': kwargs.get('resolution', '1080p'),
                'generateAudio': kwargs.get('generate_audio', True)
            }
        }

        start_time = time.time()

        # Submit and poll
        operation_name = self._submit_generation(model_name, payload)

        if not operation_name:
            return {
                'success': False,
                'error': 'Failed to submit frame control generation'
            }

        result = self._poll_operation(operation_name)

        if result['success']:
            result.update({
                'model_used': model_name,
                'processing_time': time.time() - start_time,
                'cost': self._calculate_cost(8, 'premium', kwargs.get('generate_audio', True))
            })

        return result

    def test_api_key(self):
        """
        Test if the API key is valid by making a simple request

        Returns:
            dict: {'success': bool, 'message': str}
        """
        if not self.api_key:
            return {
                'success': False,
                'error': 'No API key provided'
            }

        try:
            # Simple test with Gemini text generation
            url = f"{self.base_url}/models/gemini-2.0-flash:generateContent"

            headers = {
                'Content-Type': 'application/json',
                'x-goog-api-key': self.api_key
            }

            payload = {
                'contents': [{
                    'parts': [{
                        'text': 'Say "API key is working" in exactly those words.'
                    }]
                }]
            }

            response = requests.post(url, headers=headers, json=payload, timeout=15)

            if response.status_code == 200:
                return {
                    'success': True,
                    'message': 'API key is valid and working!'
                }
            elif response.status_code in [400, 403]:
                return {
                    'success': False,
                    'error': 'Invalid or unauthorized API key'
                }
            else:
                return {
                    'success': False,
                    'error': f'API test failed with status {response.status_code}'
                }

        except requests.exceptions.Timeout:
            return {
                'success': False,
                'error': 'Connection timed out'
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    def get_model_info(self, model_tier='standard'):
        """
        Get information about a specific model tier

        Args:
            model_tier (str): 'premium', 'standard', or 'fast'

        Returns:
            dict: Model information
        """
        return self.MODELS.get(model_tier, self.MODELS['standard'])
