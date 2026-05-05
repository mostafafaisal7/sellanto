# ai_caption/openai_service.py

"""
AI Caption Generation Service (via Unified LLM Service)
Supports text, images, and video frame analysis.
Routes through OpenAI or Gemini depending on user/key configuration.
"""

import os
import base64
import time
import tempfile
import subprocess
from django.conf import settings


class CaptionGeneratorService:
    """
    Comprehensive AI Caption Generator using the Unified LLM Service.
    Routes through Claude (primary) with OpenAI/Gemini as fallback.
    Supports:
    - Text-based caption generation
    - Image analysis and caption generation
    - Video frame extraction and analysis
    """

    def __init__(self, api_key=None, llm_service=None, user=None):
        self.user = user
        self.llm_service = llm_service
        if not self.llm_service and user:
            # Best path: build service from user with all keys (Claude primary)
            from accounts.services.llm_service import get_llm_service
            self.llm_service = get_llm_service(user)
        elif not self.llm_service and api_key:
            # Legacy path: also inject Claude key so it's preferred
            from accounts.services.llm_service import UnifiedLLMService
            from accounts.api_keys import get_claude_key
            claude_key = get_claude_key()
            self.llm_service = UnifiedLLMService(
                openai_key=api_key,
                claude_key=claude_key,
            )
        elif not self.llm_service:
            # No user, no api_key: use global Claude key
            from accounts.services.llm_service import UnifiedLLMService
            from accounts.api_keys import get_claude_key
            claude_key = get_claude_key()
            if claude_key:
                self.llm_service = UnifiedLLMService(claude_key=claude_key)
            else:
                # Last resort: try OpenAI from settings
                fallback_key = getattr(settings, 'OPENAI_API_KEY', None)
                if fallback_key:
                    self.llm_service = UnifiedLLMService(openai_key=fallback_key)
                else:
                    raise ValueError("No AI API key configured. Contact admin.")
    
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

        emoji_setting = "Include relevant emojis naturally throughout the caption" if include_emojis else "Do NOT use any emojis"
        cta_setting = "Include a clear call-to-action at the end" if include_cta else "Do NOT include any call-to-action"
        hashtag_setting = "Include relevant hashtags (separated at the end)" if include_hashtags else "Do NOT include any hashtags"

        system_prompt = f"""<role>
You are an elite social media content creator and conversion copywriter with 10+ years of experience crafting viral, high-engagement content for brands ranging from startups to Fortune 500 companies.
</role>

<writing_philosophy>
Your writing is built on these principles:
1. HOOK FIRST — The first line must earn the reader's next second. You never waste the opening on pleasantries or setup.
2. AUTHENTIC VOICE — You write like a smart friend, not a corporate brochure. Every sentence passes the "would a real person say this?" test.
3. EMOTIONAL RESONANCE — You tap into specific emotions (curiosity, aspiration, belonging, FOMO, relief, excitement) rather than generic positivity.
4. VALUE DENSITY — Every line either entertains, educates, or moves toward the CTA. No filler. No fluff. No wasted words.
5. PLATFORM INTELLIGENCE — You write natively for each platform's culture, algorithm, and reading patterns.
</writing_philosophy>

<current_style>
Writing style for this request: {tone_descriptions.get(tone, 'Professional and engaging')}
</current_style>

<platform_guidelines>
{self._get_platform_guidelines(platform)}
</platform_guidelines>

<engagement_techniques>
Apply these proven techniques where appropriate:
- Open loops ("Here's what nobody tells you about...")
- Specificity over generality ("347 customers" beats "many customers")
- Pattern interrupts in the first line
- Power words: discover, secret, mistake, finally, proof, warning, free, instant
- Micro-stories (setup > tension > resolution in 2-3 sentences)
- Direct address ("You're probably making this mistake right now")
</engagement_techniques>

<anti_patterns>
NEVER use these AI-sounding phrases:
- "In today's fast-paced world"
- "Unlock your potential" / "Unlock the power of"
- "Game-changer" / "Revolutionary" / "Cutting-edge"
- "Dive in" / "Dive deep" / "Let's dive into"
- "Elevate your" / "Level up your"
- "Leverage" / "Harness the power"
- "Seamlessly" / "Effortlessly"
- "Navigate the landscape"
- "It's not just about X, it's about Y"
- "Are you ready to..."
- Starting with "Imagine..."
</anti_patterns>

<formatting_rules>
- Emoji usage: {emoji_setting}
- Call-to-action: {cta_setting}
- Hashtag usage: {hashtag_setting}
</formatting_rules>

<output_rules>
- Return ONLY the caption text — no preamble, no explanation
- If hashtags are requested, place them on a new line at the very end
- No markdown formatting, no quotes around the text
- No meta-commentary like "Here's your caption:" or "Hope this helps!"
</output_rules>

<tone_options>
professional | casual | friendly | enthusiastic | humorous | inspirational | formal | conversational
</tone_options>

<supported_platforms>
general | facebook | instagram | twitter | linkedin | tiktok | youtube | pinterest
</supported_platforms>"""

        # Per-user admin override (no-op if no override is configured)
        try:
            from accounts.services.prompt_resolver import resolve_prompt
            caption_vars = {
                'tone_description': tone_descriptions.get(tone, 'Professional and engaging'),
                'platform_guidelines': self._get_platform_guidelines(platform),
                'emoji_setting': emoji_setting,
                'cta_setting': cta_setting,
                'hashtag_setting': hashtag_setting,
            }
            system_prompt = resolve_prompt(
                self.user, 'caption_system', system_prompt, caption_vars,
            )
        except Exception:
            pass

        return system_prompt
    
    def generate_from_text(self, topic, tone='professional', length='medium', platform='general',
                           include_hashtags=True, include_emojis=True, include_cta=True,
                           custom_instructions=None, override_prompt=None, think_harder=False):
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
        start_time = time.time()

        try:
            system_prompt = self._build_system_prompt(tone, platform, include_hashtags, include_emojis, include_cta)

            user_prompt = f"""<task>
Create a single social media caption about the topic below.
</task>

<topic>
{topic}
</topic>

<parameters>
- Target length: {self._get_word_count(length)}
- Custom instructions: {custom_instructions or 'None'}
</parameters>

<approach>
Think step by step:
1. Identify the single most compelling angle for this topic.
2. Choose a hook type that will stop the scroll (question, bold claim, stat, micro-story, or curiosity gap).
3. Write the caption in one pass — it should flow naturally, not feel assembled.
4. Ensure it hits the target word count within +/-10 words.
</approach>

<length_guide>
short = 20-40 words | medium = 40-80 words | long = 80-120 words | extra_long = 120-200 words
</length_guide>

Generate the caption now."""

            if override_prompt:
                user_prompt = override_prompt

            result = self.llm_service.chat_completion(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                model="gpt-4o",
                temperature=0.8,
                max_tokens=1500 if think_harder else 800,
                thinking_budget=10000 if think_harder else 0,
            )

            if not result.success:
                raise Exception(result.error)

            caption = result.content.strip()
            tokens_used = result.tokens_used
            processing_time = time.time() - start_time

            # Extract hashtags if present
            hashtags = ""
            if include_hashtags and '#' in caption:
                import re
                lines = caption.split('\n')
                # Only treat lines that are PURELY hashtags (no substantial text before them)
                pure_hashtag_lines = []
                for l in lines:
                    stripped = l.strip()
                    if not stripped:
                        continue
                    # Line starts with # and is mostly hashtags
                    words = stripped.split()
                    hashtag_words = [w for w in words if w.startswith('#')]
                    non_hashtag_words = [w for w in words if not w.startswith('#')]
                    if len(hashtag_words) >= 2 and len(non_hashtag_words) <= 1:
                        pure_hashtag_lines.append(l)

                if pure_hashtag_lines:
                    hashtags = pure_hashtag_lines[-1].strip()
                    caption = '\n'.join([l for l in lines if l not in pure_hashtag_lines]).strip()

                # If no pure hashtag lines found but caption has inline hashtags, extract them
                if not hashtags:
                    all_tags = re.findall(r'#\w+', caption)
                    if all_tags:
                        hashtags = ' '.join(all_tags)
            
            return {
                'success': True,
                'caption': caption,
                'hashtags': hashtags,
                'tokens_used': tokens_used,
                'processing_time': processing_time,
                'model_used': result.model or 'gpt-4o',
                'used_prompt': f"SYSTEM:\n{system_prompt}\n\nUSER:\n{user_prompt}",
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
        try:
            base64_image = self._encode_image(image_path)
            mime_type = self._get_mime_type(image_path)

            result = self.llm_service.chat_completion(
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": """<task>
Analyze the attached image in detail to support social media caption generation.
Your analysis will be used by a caption-writing system, so be specific, vivid, and actionable.
</task>

<instructions>
Examine the image systematically. For each aspect, provide specific observations — not vague summaries:

1. **Main subject/focus** — What is the primary element? Where does the eye land first? What makes it stand out?
2. **Setting/background** — Describe the environment. Indoor/outdoor? Urban/natural? Any identifiable location cues?
3. **Colors and mood** — What is the dominant color palette? What emotional tone do the colors and composition create? (e.g., warm and inviting, cool and professional, vibrant and energetic)
4. **Visible text** — Transcribe any text, logos, signage, or labels exactly as they appear.
5. **People** — If present: how many, approximate age range, what are they doing, what expressions do they show, what are they wearing? What's the interpersonal dynamic?
6. **Objects and composition** — What objects are visible? How are they arranged? Is there visual hierarchy, symmetry, leading lines, or rule of thirds?
7. **Overall narrative** — If this image were telling a story, what would it be? What message or feeling does it convey?
8. **Social media angles** — Suggest 3 specific content angles this image could support (e.g., "behind-the-scenes culture post," "product feature highlight," "customer success story").
</instructions>

<constraints>
- Be specific: "A woman in her 30s laughing while holding a blue mug" beats "A person with a drink."
- Describe only what you can actually see — do not infer brand names, locations, or identities unless they're clearly visible.
- Keep the total analysis under 300 words.
</constraints>"""
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
                model="gpt-4o",
                max_tokens=800,
            )

            if not result.success:
                raise Exception(result.error)

            return {
                'success': True,
                'analysis': result.content.strip()
            }

        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def generate_from_image(self, image_path, additional_context=None, tone='professional',
                            length='medium', platform='general', include_hashtags=True,
                            include_emojis=True, include_cta=True, custom_instructions=None,
                            override_prompt=None, think_harder=False):
        """
        Generate caption from image using GPT-4o Vision
        
        Args:
            image_path: Path to the image file
            additional_context: Optional context about the image
            tone, length, platform, etc.: Same as generate_from_text
            
        Returns:
            dict: {success, caption, hashtags, analysis, tokens_used, processing_time, error}
        """
        start_time = time.time()

        try:
            base64_image = self._encode_image(image_path)
            mime_type = self._get_mime_type(image_path)

            system_prompt = self._build_system_prompt(tone, platform, include_hashtags, include_emojis, include_cta)

            user_prompt = f"""<task>
Analyze the attached image, then create an engaging social media caption grounded in what you actually see.
</task>

<parameters>
- Additional context from user: {additional_context or 'None'}
- Target length: {self._get_word_count(length)}
{f'- Custom instructions: {custom_instructions}' if custom_instructions else ''}
</parameters>

<instructions>
Think step by step:
1. OBSERVE: Scan the image carefully. Note the subject, setting, colors, mood, people, objects, and any text visible.
2. IDENTIFY the most compelling story, emotion, or message the image conveys.
3. CONNECT: If additional context is provided, weave it naturally into the caption — don't force it.
4. WRITE: Create a caption that would make someone who hasn't seen the image curious, and someone who has seen it feel understood.
</instructions>

<output_format>
Structure your response exactly as follows:

ANALYSIS: [2-3 sentence detailed description of what you see]
CAPTION: [The generated social media caption]
</output_format>

<constraints>
- The caption must be grounded in visible image content — do not invent elements.
- Follow the system prompt's tone and platform guidelines.
- The caption should work both with and without the image visible.
</constraints>"""

            if override_prompt:
                user_prompt = override_prompt

            result = self.llm_service.chat_completion(
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
                model="gpt-4o",
                temperature=0.8,
                max_tokens=1500 if think_harder else 800,
                thinking_budget=10000 if think_harder else 0,
            )

            if not result.success:
                raise Exception(result.error)

            full_response = result.content.strip()
            tokens_used = result.tokens_used
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
                'model_used': result.model or 'gpt-4o',
                'used_prompt': f"SYSTEM:\n{system_prompt}\n\nUSER:\n{user_prompt}",
            }

        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'processing_time': time.time() - start_time
            }

    def generate_from_video(self, video_path, additional_context=None, tone='professional',
                            length='medium', platform='general', include_hashtags=True,
                            include_emojis=True, include_cta=True, custom_instructions=None,
                            override_prompt=None, think_harder=False):
        """
        Generate caption from video by extracting and analyzing frames
        
        Args:
            video_path: Path to the video file
            Other args: Same as generate_from_image
            
        Returns:
            dict: {success, caption, hashtags, analysis, tokens_used, processing_time, error}
        """
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
                    "text": f"""<task>
The attached images are frames extracted from a video, presented in chronological order. Analyze the full sequence to understand the story, then generate an engaging caption.
</task>

<parameters>
- Target length: {self._get_word_count(length)}
{f'- Context provided: {additional_context}' if additional_context else ''}
{f'- Custom instructions: {custom_instructions}' if custom_instructions else ''}
</parameters>

<instructions>
Think step by step:
1. SCAN all frames in order — identify the beginning, middle, and end of the visual narrative.
2. IDENTIFY: What is happening? What changes across frames? What's the key moment or transformation?
3. FIND THE HOOK: What's the single most interesting, surprising, or emotional aspect of this video?
4. WRITE a caption that captures the essence of the video — not a frame-by-frame description, but the feeling and story it conveys.
</instructions>

<output_format>
ANALYSIS: [2-3 sentences describing the video's content, story arc, and key moments]
CAPTION: [The generated social media caption]
</output_format>

<constraints>
- Treat the frames as a SEQUENCE — look for narrative flow, not just individual stills.
- The caption should make someone want to watch the video, not replace it.
- Follow the system prompt's tone and platform guidelines.
</constraints>"""
                }
            ]
            
            if override_prompt:
                content[0]["text"] = override_prompt

            # Add frame images
            for frame_path in frames:
                base64_image = self._encode_image(frame_path)
                content.append({
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{base64_image}"
                    }
                })
            
            result = self.llm_service.chat_completion(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": content}
                ],
                model="gpt-4o",
                temperature=0.8,
                max_tokens=1500 if think_harder else 800,
                thinking_budget=10000 if think_harder else 0,
            )

            if not result.success:
                raise Exception(result.error)

            full_response = result.content.strip()
            tokens_used = result.tokens_used
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
            
            # Extract text prompt from content array for video
            video_user_prompt = content[0]["text"] if content and isinstance(content, list) else str(content)
            return {
                'success': True,
                'caption': caption,
                'hashtags': hashtags,
                'analysis': analysis,
                'tokens_used': tokens_used,
                'processing_time': processing_time,
                'model_used': result.model or 'gpt-4o',
                'used_prompt': f"SYSTEM:\n{system_prompt}\n\nUSER:\n{video_user_prompt}",
            }

        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'processing_time': time.time() - start_time
            }

    def regenerate_with_feedback(self, original_caption, feedback, tone='professional',
                                  platform='general', include_hashtags=True,
                                  include_emojis=True, include_cta=True, think_harder=False):
        """
        Regenerate caption based on user feedback
        
        Args:
            original_caption: The original generated caption
            feedback: User's feedback/instructions for improvement
            
        Returns:
            dict: {success, caption, hashtags, tokens_used, processing_time, error}
        """
        start_time = time.time()

        try:
            system_prompt = self._build_system_prompt(tone, platform, include_hashtags, include_emojis, include_cta)

            user_prompt = f"""<task>
Regenerate a social media caption based on user feedback. The new version must be noticeably better than the original — not just slightly adjusted.
</task>

<original_caption>
{original_caption}
</original_caption>

<user_feedback>
{feedback}
</user_feedback>

<instructions>
Think step by step:
1. DIAGNOSE: What specifically is the user unhappy with? Map their feedback to concrete issues (too long, wrong tone, weak hook, missing CTA, too generic, etc.).
2. PRESERVE: Identify what works in the original — don't throw out the baby with the bathwater.
3. REWRITE: Create a new caption that addresses ALL feedback points while maintaining or improving quality. If the user says "make it shorter," don't just trim — rewrite with brevity in mind from the start.
4. VERIFY: Re-read the feedback and confirm every point has been addressed.
</instructions>

<constraints>
- Return ONLY the new caption text — no explanation, no "Here's your updated version."
- The new caption must demonstrably address the feedback.
- Do not degrade quality while accommodating feedback.
</constraints>"""

            result = self.llm_service.chat_completion(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                model="gpt-4o",
                temperature=0.8,
                max_tokens=1500 if think_harder else 500,
                thinking_budget=10000 if think_harder else 0,
            )

            if not result.success:
                raise Exception(result.error)

            caption = result.content.strip()
            tokens_used = result.tokens_used
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
                'model_used': result.model or 'gpt-4o',
                'used_prompt': f"SYSTEM:\n{system_prompt}\n\nUSER:\n{user_prompt}",
            }

        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'processing_time': time.time() - start_time
            }

    def generate_multiple_variations(self, topic_or_analysis, num_variations=3, tone='professional',
                                      length='medium', platform='general', include_hashtags=True,
                                      include_emojis=True, include_cta=True, think_harder=False):
        """
        Generate multiple caption variations at once
        
        Args:
            topic_or_analysis: Topic text or image/video analysis
            num_variations: Number of variations to generate (1-5)
            
        Returns:
            dict: {success, captions: [list of captions], tokens_used, processing_time, error}
        """
        start_time = time.time()
        num_variations = min(max(num_variations, 1), 5)  # Limit 1-5

        try:
            system_prompt = self._build_system_prompt(tone, platform, include_hashtags, include_emojis, include_cta)

            user_prompt = f"""<task>
Generate {num_variations} distinctly different social media caption variations for the topic or analysis below. Each must feel like it was written by a different creative mind with a different strategy.
</task>

<topic_or_analysis>
{topic_or_analysis}
</topic_or_analysis>

<parameters>
- Target length per caption: {self._get_word_count(length)}
</parameters>

<instructions>
Think step by step:
1. BRAINSTORM {num_variations} completely different creative strategies:
   - Variation 1: Different HOOK type (e.g., question vs. bold statement vs. stat)
   - Variation 2: Different ANGLE (e.g., educational vs. emotional vs. humorous)
   - Variation 3+: Different PERSUASION style (e.g., FOMO vs. aspiration vs. social proof)
2. WRITE each variation independently — do not reference or build upon the others.
3. NUMBER each variation clearly: 1., 2., 3., etc.
4. Each caption must be complete and ready to post as-is.
</instructions>

<quality_checklist>
Before finalizing, verify each caption:
- Opens with a different first word than all other variations
- Uses a different sentence structure than all other variations
- Appeals to a different emotion than all other variations
- Could stand alone without the others
- Hits the target word count +/-10 words
</quality_checklist>

<constraints>
- Do NOT create variations that are merely synonym swaps or reordered sentences.
- If two variations feel similar, rewrite one from scratch.
- Stay within the target word count for each.
</constraints>

Generate {num_variations} distinct captions now."""

            result = self.llm_service.chat_completion(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                model="gpt-4o",
                temperature=0.9,
                max_tokens=2000 if think_harder else 1000,
                thinking_budget=10000 if think_harder else 0,
            )

            if not result.success:
                raise Exception(result.error)

            full_response = result.content.strip()
            tokens_used = result.tokens_used
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
                'model_used': result.model or 'gpt-4o',
                'used_prompt': f"SYSTEM:\n{system_prompt}\n\nUSER:\n{user_prompt}",
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
