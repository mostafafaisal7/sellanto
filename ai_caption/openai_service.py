# ai_caption/openai_service.py

"""
OpenAI Service for AI Caption Generation
Supports text, images, and video frame analysis
"""

import os
import base64
import time
import tempfile
import subprocess
from openai import OpenAI
from django.conf import settings


class CaptionGeneratorService:
    """
    Comprehensive AI Caption Generator using OpenAI GPT-4o
    Supports:
    - Text-based caption generation
    - Image analysis and caption generation
    - Video frame extraction and analysis
    """
    
    def __init__(self, api_key=None):
        self.api_key = api_key or getattr(settings, 'OPENAI_API_KEY', None)
        if self.api_key:
            self.client = OpenAI(api_key=self.api_key)
        else:
            self.client = None
    
    def _get_word_count(self, length):
        """Get word count range based on length setting"""
        word_counts = {
            'short': '20-40 words',
            'medium': '40-80 words',
            'long': '80-120 words',
            'extra_long': '120-200 words'
        }
        return word_counts.get(length, '40-80 words')
    
    def _get_platform_guidelines(self, platform):
        """Get platform-specific guidelines"""
        guidelines = {
            'general': "Create a versatile caption suitable for any platform.",
            'facebook': "Optimize for Facebook: longer captions work well, include engaging questions, consider Facebook's algorithm favoring meaningful interactions.",
            'instagram': "Optimize for Instagram: strong opening line, use line breaks for readability, hashtags at the end (up to 30 allowed but 5-10 recommended), consider Instagram's visual-first nature.",
            'twitter': "Optimize for Twitter/X: Keep it concise (under 280 characters ideally), punchy and engaging, 1-3 hashtags max, consider thread potential.",
            'linkedin': "Optimize for LinkedIn: Professional tone, industry insights, thought leadership angle, minimal hashtags (3-5), strong opening hook.",
            'tiktok': "Optimize for TikTok: Trendy, casual tone, use trending sounds/challenges references if relevant, short and catchy, viral potential.",
            'youtube': "Optimize for YouTube: SEO-friendly, include keywords, compelling description, call to subscribe/engage.",
            'pinterest': "Optimize for Pinterest: Descriptive, SEO-rich, include keywords users might search for, inspirational tone."
        }
        return guidelines.get(platform, guidelines['general'])
    
    def _build_system_prompt(self, tone, platform, include_hashtags, include_emojis, include_cta):
        """Build the system prompt based on settings"""
        tone_descriptions = {
            'professional': "Professional, polished, and authoritative",
            'casual': "Relaxed, conversational, and approachable",
            'friendly': "Warm, welcoming, and personable",
            'enthusiastic': "Energetic, excited, and passionate",
            'humorous': "Witty, playful, and entertaining",
            'inspirational': "Motivating, uplifting, and empowering",
            'formal': "Formal, sophisticated, and refined",
            'conversational': "Natural, flowing, like talking to a friend"
        }
        
        system_prompt = f"""You are an expert social media content creator and copywriter with years of experience crafting viral, engaging content.

Your writing style is: {tone_descriptions.get(tone, 'Professional and engaging')}

{self._get_platform_guidelines(platform)}

Guidelines:
- Write authentic, human-sounding content (avoid AI-sounding phrases)
- Create scroll-stopping opening lines
- Use power words that trigger emotion
- {"Include relevant emojis naturally throughout the caption" if include_emojis else "Do NOT use any emojis"}
- {"Include a clear call-to-action at the end" if include_cta else "Do NOT include any call-to-action"}
- {"Include relevant hashtags (separated at the end)" if include_hashtags else "Do NOT include any hashtags"}

Output Format:
- Return ONLY the caption text
- If hashtags are requested, put them on a new line at the very end
- No explanations, no markdown formatting, no quotes around the text"""
        
        return system_prompt
    
    def generate_from_text(self, topic, tone='professional', length='medium', platform='general',
                           include_hashtags=True, include_emojis=True, include_cta=True,
                           custom_instructions=None):
        """
        Generate caption from text/topic
        
        Args:
            topic: The topic, keywords, or text to generate caption from
            tone: Writing tone (professional, casual, friendly, etc.)
            length: Caption length (short, medium, long, extra_long)
            platform: Target platform for optimization
            include_hashtags: Whether to include hashtags
            include_emojis: Whether to include emojis
            include_cta: Whether to include call-to-action
            custom_instructions: Additional custom instructions
            
        Returns:
            dict: {success, caption, hashtags, tokens_used, processing_time, error}
        """
        if not self.client:
            return {
                'success': False,
                'error': 'OpenAI API key not configured'
            }
        
        start_time = time.time()
        
        try:
            system_prompt = self._build_system_prompt(tone, platform, include_hashtags, include_emojis, include_cta)
            
            user_prompt = f"""Create a social media caption about: {topic}

Target length: {self._get_word_count(length)}
{f'Additional instructions: {custom_instructions}' if custom_instructions else ''}

Generate the caption now:"""
            
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.8,
                max_tokens=500
            )
            
            caption = response.choices[0].message.content.strip()
            tokens_used = response.usage.total_tokens if response.usage else 0
            processing_time = time.time() - start_time
            
            # Extract hashtags if present
            hashtags = ""
            if include_hashtags and '#' in caption:
                lines = caption.split('\n')
                hashtag_lines = [l for l in lines if l.strip().startswith('#') or l.count('#') > 2]
                if hashtag_lines:
                    hashtags = hashtag_lines[-1].strip()
                    # Remove hashtag line from caption
                    caption = '\n'.join([l for l in lines if l not in hashtag_lines]).strip()
            
            return {
                'success': True,
                'caption': caption,
                'hashtags': hashtags,
                'tokens_used': tokens_used,
                'processing_time': processing_time,
                'model_used': 'gpt-4o'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'processing_time': time.time() - start_time
            }
    
    def _encode_image(self, image_path):
        """Encode image to base64"""
        with open(image_path, 'rb') as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')
    
    def _get_mime_type(self, file_path):
        """Get MIME type from file extension"""
        ext = os.path.splitext(file_path)[1].lower()
        mime_types = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.bmp': 'image/bmp'
        }
        return mime_types.get(ext, 'image/jpeg')
    
    def _extract_video_frames(self, video_path, num_frames=4):
        """
        Extract frames from video for analysis
        Uses ffmpeg if available, otherwise returns None
        """
        try:
            # Create temp directory for frames
            temp_dir = tempfile.mkdtemp()
            frames = []
            
            # Get video duration using ffprobe
            duration_cmd = [
                'ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1', video_path
            ]
            
            try:
                duration_result = subprocess.run(duration_cmd, capture_output=True, text=True, timeout=30)
                duration = float(duration_result.stdout.strip())
            except:
                duration = 30  # Default assumption
            
            # Calculate frame timestamps
            interval = duration / (num_frames + 1)
            timestamps = [interval * (i + 1) for i in range(num_frames)]
            
            # Extract frames
            for i, ts in enumerate(timestamps):
                frame_path = os.path.join(temp_dir, f'frame_{i}.jpg')
                extract_cmd = [
                    'ffmpeg', '-ss', str(ts), '-i', video_path,
                    '-vframes', '1', '-q:v', '2', frame_path,
                    '-y', '-loglevel', 'error'
                ]
                
                subprocess.run(extract_cmd, capture_output=True, timeout=30)
                
                if os.path.exists(frame_path):
                    frames.append(frame_path)
            
            return frames, temp_dir
            
        except Exception as e:
            print(f"Error extracting video frames: {e}")
            return [], None
    
    def analyze_image(self, image_path):
        """
        Analyze image and return detailed description
        
        Args:
            image_path: Path to the image file
            
        Returns:
            dict: {success, analysis, error}
        """
        if not self.client:
            return {'success': False, 'error': 'OpenAI API key not configured'}
        
        try:
            base64_image = self._encode_image(image_path)
            mime_type = self._get_mime_type(image_path)
            
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": """Analyze this image in detail. Describe:
1. Main subject/focus
2. Setting/background
3. Colors and mood
4. Any text visible
5. People (if any) - their actions, expressions
6. Objects and their arrangement
7. Overall theme/message
8. Potential use cases for social media

Be specific and detailed."""
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{mime_type};base64,{base64_image}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=800
            )
            
            return {
                'success': True,
                'analysis': response.choices[0].message.content.strip()
            }
            
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def generate_from_image(self, image_path, additional_context=None, tone='professional',
                            length='medium', platform='general', include_hashtags=True,
                            include_emojis=True, include_cta=True, custom_instructions=None):
        """
        Generate caption from image using GPT-4o Vision
        
        Args:
            image_path: Path to the image file
            additional_context: Optional context about the image
            tone, length, platform, etc.: Same as generate_from_text
            
        Returns:
            dict: {success, caption, hashtags, analysis, tokens_used, processing_time, error}
        """
        if not self.client:
            return {'success': False, 'error': 'OpenAI API key not configured'}
        
        start_time = time.time()
        
        try:
            base64_image = self._encode_image(image_path)
            mime_type = self._get_mime_type(image_path)
            
            system_prompt = self._build_system_prompt(tone, platform, include_hashtags, include_emojis, include_cta)
            
            user_prompt = f"""Analyze this image and create an engaging social media caption for it.

{f'Context provided: {additional_context}' if additional_context else ''}
{f'Additional instructions: {custom_instructions}' if custom_instructions else ''}

Target length: {self._get_word_count(length)}

First, briefly describe what you see in the image (2-3 sentences).
Then, create the caption.

Format your response as:
ANALYSIS: [your image analysis]
CAPTION: [the generated caption]"""
            
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": user_prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{mime_type};base64,{base64_image}"
                                }
                            }
                        ]
                    }
                ],
                temperature=0.8,
                max_tokens=800
            )
            
            full_response = response.choices[0].message.content.strip()
            tokens_used = response.usage.total_tokens if response.usage else 0
            processing_time = time.time() - start_time
            
            # Parse response
            analysis = ""
            caption = full_response
            
            if "ANALYSIS:" in full_response and "CAPTION:" in full_response:
                parts = full_response.split("CAPTION:")
                analysis = parts[0].replace("ANALYSIS:", "").strip()
                caption = parts[1].strip()
            
            # Extract hashtags
            hashtags = ""
            if include_hashtags and '#' in caption:
                lines = caption.split('\n')
                hashtag_lines = [l for l in lines if l.strip().startswith('#') or l.count('#') > 2]
                if hashtag_lines:
                    hashtags = hashtag_lines[-1].strip()
                    caption = '\n'.join([l for l in lines if l not in hashtag_lines]).strip()
            
            return {
                'success': True,
                'caption': caption,
                'hashtags': hashtags,
                'analysis': analysis,
                'tokens_used': tokens_used,
                'processing_time': processing_time,
                'model_used': 'gpt-4o'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'processing_time': time.time() - start_time
            }
    
    def generate_from_video(self, video_path, additional_context=None, tone='professional',
                            length='medium', platform='general', include_hashtags=True,
                            include_emojis=True, include_cta=True, custom_instructions=None):
        """
        Generate caption from video by extracting and analyzing frames
        
        Args:
            video_path: Path to the video file
            Other args: Same as generate_from_image
            
        Returns:
            dict: {success, caption, hashtags, analysis, tokens_used, processing_time, error}
        """
        if not self.client:
            return {'success': False, 'error': 'OpenAI API key not configured'}
        
        start_time = time.time()
        
        try:
            # Extract frames from video
            frames, temp_dir = self._extract_video_frames(video_path, num_frames=4)
            
            if not frames:
                # Fallback: Just use context if no frames extracted
                return self.generate_from_text(
                    topic=additional_context or "A video",
                    tone=tone,
                    length=length,
                    platform=platform,
                    include_hashtags=include_hashtags,
                    include_emojis=include_emojis,
                    include_cta=include_cta,
                    custom_instructions=f"This is for a video. {custom_instructions or ''}"
                )
            
            # Build message with multiple frames
            system_prompt = self._build_system_prompt(tone, platform, include_hashtags, include_emojis, include_cta)
            
            content = [
                {
                    "type": "text",
                    "text": f"""These are frames extracted from a video. Analyze them to understand the video content and create an engaging social media caption.

{f'Context provided: {additional_context}' if additional_context else ''}
{f'Additional instructions: {custom_instructions}' if custom_instructions else ''}

Target length: {self._get_word_count(length)}

First, describe what you see across these video frames (the story/action).
Then, create the caption.

Format your response as:
ANALYSIS: [your video analysis]
CAPTION: [the generated caption]"""
                }
            ]
            
            # Add frame images
            for frame_path in frames:
                base64_image = self._encode_image(frame_path)
                content.append({
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{base64_image}"
                    }
                })
            
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": content}
                ],
                temperature=0.8,
                max_tokens=800
            )
            
            full_response = response.choices[0].message.content.strip()
            tokens_used = response.usage.total_tokens if response.usage else 0
            processing_time = time.time() - start_time
            
            # Cleanup temp files
            if temp_dir:
                import shutil
                shutil.rmtree(temp_dir, ignore_errors=True)
            
            # Parse response
            analysis = ""
            caption = full_response
            
            if "ANALYSIS:" in full_response and "CAPTION:" in full_response:
                parts = full_response.split("CAPTION:")
                analysis = parts[0].replace("ANALYSIS:", "").strip()
                caption = parts[1].strip()
            
            # Extract hashtags
            hashtags = ""
            if include_hashtags and '#' in caption:
                lines = caption.split('\n')
                hashtag_lines = [l for l in lines if l.strip().startswith('#') or l.count('#') > 2]
                if hashtag_lines:
                    hashtags = hashtag_lines[-1].strip()
                    caption = '\n'.join([l for l in lines if l not in hashtag_lines]).strip()
            
            return {
                'success': True,
                'caption': caption,
                'hashtags': hashtags,
                'analysis': analysis,
                'tokens_used': tokens_used,
                'processing_time': processing_time,
                'model_used': 'gpt-4o'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'processing_time': time.time() - start_time
            }
    
    def regenerate_with_feedback(self, original_caption, feedback, tone='professional',
                                  platform='general', include_hashtags=True,
                                  include_emojis=True, include_cta=True):
        """
        Regenerate caption based on user feedback
        
        Args:
            original_caption: The original generated caption
            feedback: User's feedback/instructions for improvement
            
        Returns:
            dict: {success, caption, hashtags, tokens_used, processing_time, error}
        """
        if not self.client:
            return {'success': False, 'error': 'OpenAI API key not configured'}
        
        start_time = time.time()
        
        try:
            system_prompt = self._build_system_prompt(tone, platform, include_hashtags, include_emojis, include_cta)
            
            user_prompt = f"""Here is a social media caption that was previously generated:

"{original_caption}"

The user wants changes based on this feedback: {feedback}

Please regenerate the caption incorporating this feedback while maintaining quality.
Return ONLY the new caption."""
            
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.8,
                max_tokens=500
            )
            
            caption = response.choices[0].message.content.strip()
            tokens_used = response.usage.total_tokens if response.usage else 0
            processing_time = time.time() - start_time
            
            # Extract hashtags
            hashtags = ""
            if include_hashtags and '#' in caption:
                lines = caption.split('\n')
                hashtag_lines = [l for l in lines if l.strip().startswith('#') or l.count('#') > 2]
                if hashtag_lines:
                    hashtags = hashtag_lines[-1].strip()
                    caption = '\n'.join([l for l in lines if l not in hashtag_lines]).strip()
            
            return {
                'success': True,
                'caption': caption,
                'hashtags': hashtags,
                'tokens_used': tokens_used,
                'processing_time': processing_time,
                'model_used': 'gpt-4o'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'processing_time': time.time() - start_time
            }
    
    def generate_multiple_variations(self, topic_or_analysis, num_variations=3, tone='professional',
                                      length='medium', platform='general', include_hashtags=True,
                                      include_emojis=True, include_cta=True):
        """
        Generate multiple caption variations at once
        
        Args:
            topic_or_analysis: Topic text or image/video analysis
            num_variations: Number of variations to generate (1-5)
            
        Returns:
            dict: {success, captions: [list of captions], tokens_used, processing_time, error}
        """
        if not self.client:
            return {'success': False, 'error': 'OpenAI API key not configured'}
        
        start_time = time.time()
        num_variations = min(max(num_variations, 1), 5)  # Limit 1-5
        
        try:
            system_prompt = self._build_system_prompt(tone, platform, include_hashtags, include_emojis, include_cta)
            
            user_prompt = f"""Create {num_variations} DIFFERENT social media caption variations for: {topic_or_analysis}

Target length per caption: {self._get_word_count(length)}

Requirements:
- Each caption should have a unique angle/approach
- Vary the opening hooks
- Different emotional appeals
- Number each variation (1., 2., 3., etc.)

Generate {num_variations} distinct captions now:"""
            
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.9,
                max_tokens=1000
            )
            
            full_response = response.choices[0].message.content.strip()
            tokens_used = response.usage.total_tokens if response.usage else 0
            processing_time = time.time() - start_time
            
            # Parse variations
            captions = []
            lines = full_response.split('\n')
            current_caption = []
            
            for line in lines:
                # Check if new variation starts
                if any(line.strip().startswith(f"{i}.") or line.strip().startswith(f"{i})") for i in range(1, 10)):
                    if current_caption:
                        captions.append('\n'.join(current_caption).strip())
                    # Remove the number prefix
                    cleaned = line.strip()
                    for i in range(1, 10):
                        cleaned = cleaned.lstrip(f"{i}.").lstrip(f"{i})").strip()
                    current_caption = [cleaned] if cleaned else []
                else:
                    if line.strip():
                        current_caption.append(line)
            
            # Add last caption
            if current_caption:
                captions.append('\n'.join(current_caption).strip())
            
            return {
                'success': True,
                'captions': captions,
                'tokens_used': tokens_used,
                'processing_time': processing_time,
                'model_used': 'gpt-4o'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'processing_time': time.time() - start_time
            }


# Legacy compatibility
class OpenAIService:
    """Legacy wrapper for backward compatibility"""
    
    @staticmethod
    def generate_caption_from_text(topic, tone='professional', length='medium'):
        service = CaptionGeneratorService()
        result = service.generate_from_text(topic, tone, length)
        if result['success']:
            caption = result['caption']
            if result.get('hashtags'):
                caption += '\n\n' + result['hashtags']
            return True, caption
        return False, result.get('error', 'Unknown error')
    
    @staticmethod
    def generate_caption_from_image(image_path, additional_context=""):
        service = CaptionGeneratorService()
        result = service.generate_from_image(image_path, additional_context)
        if result['success']:
            caption = result['caption']
            if result.get('hashtags'):
                caption += '\n\n' + result['hashtags']
            return True, caption
        return False, result.get('error', 'Unknown error')
