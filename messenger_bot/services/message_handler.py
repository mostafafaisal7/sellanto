# C:\Users\Trust computer\Desktop\Final_version_socialSync\messenger_bot\services\message_handler.py

"""
Message Handler Service
Processes incoming messages, attachments, images, URLs, and generates AI responses
Complete automation with image recognition, Knowledge Base matching, and Important Message Detection
"""

import json
import logging
import requests
import time
import re
import base64
from urllib.parse import urlparse
from typing import Dict, List, Optional, Tuple
from django.utils import timezone
from ..models import MessengerConnection, Conversation, Message, Notification
from .rag_engine import RAGEngine
from .openai_client import OpenAIClient

logger = logging.getLogger(__name__)


# Keywords for detecting important messages (fallback if AI is not available)
IMPORTANT_KEYWORDS = {
    'product_inquiry': [
        'কিনতে চাই', 'buy', 'purchase', 'order', 'অর্ডার', 'দাম কত', 'price', 'cost',
        'এটা লাগবে', 'চাই', 'নিব', 'দিন', 'পাঠান', 'send', 'deliver', 'ডেলিভারি',
        'stock', 'available', 'আছে কি', 'পাওয়া যাবে', 'product', 'প্রোডাক্ট'
    ],
    'appointment': [
        'appointment', 'মিটিং', 'meeting', 'দেখা করতে চাই', 'সময়', 'time', 'schedule',
        'book', 'বুক', 'reserve', 'visit', 'ভিজিট', 'আসতে চাই', 'যেতে চাই',
        'কথা বলতে চাই', 'call', 'ফোন'
    ],
    'order': [
        'confirm order', 'অর্ডার কনফার্ম', 'place order', 'checkout', 'payment',
        'পেমেন্ট', 'বিকাশ', 'bkash', 'নগদ', 'nagad', 'rocket', 'রকেট'
    ],
    'urgent': [
        'urgent', 'জরুরি', 'asap', 'emergency', 'এখনই', 'immediately', 'দরকার',
        'quickly', 'fast', 'তাড়াতাড়ি'
    ],
    'complaint': [
        'complaint', 'problem', 'সমস্যা', 'issue', 'broken', 'ভাঙা', 'defective',
        'না পেয়েছি', 'not received', 'wrong', 'ভুল', 'refund', 'রিফান্ড', 'return'
    ],
    'pricing': [
        'দাম', 'price', 'cost', 'কত টাকা', 'how much', 'rate', 'রেট', 'offer',
        'discount', 'ডিসকাউন্ট', 'ছাড়'
    ],
    'availability': [
        'available', 'আছে', 'stock', 'স্টক', 'পাওয়া যাবে', 'আসবে কবে', 'when',
        'কখন পাব'
    ],
    'contact': [
        'phone number', 'ফোন নম্বর', 'contact', 'address', 'ঠিকানা', 'location',
        'যোগাযোগ', 'কোথায়', 'where'
    ]
}


class MessageHandler:
    """
    Handles incoming Facebook Messenger messages with complete automation
    - Text message processing
    - Image recognition and analysis with Knowledge Base matching
    - Important message detection and notification
    - URL detection and extraction
    - File attachment handling
    """
    
    # URL regex pattern
    URL_PATTERN = re.compile(
        r'https?://(?:www\.)?'
        r'(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+[a-z]{2,}(?:/[^\s]*)?|\b'
        r'(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+[a-z]{2,}\b(?:/[^\s]*)?',
        re.IGNORECASE
    )
    
    IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico'}
    
    def __init__(self, connection: MessengerConnection):
        self.connection = connection
        self.page_access_token = connection.page_access_token
        self.rag_engine = None
        self.openai_client = None

        logger.info(f"[MH] Initializing MessageHandler for: {connection.page_name}")

        # Try to get AI config
        try:
            ai_config = getattr(connection, 'ai_config', None)
            if ai_config:
                logger.info(f"[MH] AI Config found - Model: {ai_config.openai_model}, RAG: {ai_config.rag_enabled}")

                # Initialize OpenAI client
                if ai_config.openai_api_key:
                    self.openai_client = OpenAIClient(ai_config.openai_api_key)
                    logger.info("[MH] OpenAI client initialized")

                # Initialize RAG engine
                if ai_config.rag_enabled:
                    try:
                        self.rag_engine = RAGEngine(ai_config)
                        logger.info("[MH] RAG engine initialized")
                    except Exception as e:
                        logger.warning(f"[MH] RAG engine init failed: {e}")
            else:
                logger.warning("[MH] No AI Config found for this connection")
        except Exception as e:
            logger.error(f"[MH] Error accessing AI config: {e}", exc_info=True)
    
    def process_message(
        self, 
        sender_id: str, 
        message_data: Dict = None,
        message_text: str = None,
        attachments: List = None,
        message_id: str = None
    ) -> bool:
        """Process incoming message with all features"""
        try:
            logger.info(f"[MH] Processing message from: {sender_id}")

            if message_data:
                message_text = message_data.get('text', '')
                attachments = message_data.get('attachments', [])
                message_id = message_data.get('mid')

            logger.info(f"[MH] Text: {(message_text[:50] if message_text else '[empty]')}...")

            # Get or create conversation with user info
            conversation = self._get_or_create_conversation(sender_id)
            logger.info(f"[MH] Conversation ID: {conversation.id}")
            
            # Process message content
            message_type = 'text'
            processed_content = message_text or ""
            image_urls = []
            file_urls = []
            audio_urls = []
            image_analysis_result = None
            voice_transcription = None
            
            # Process attachments
            if attachments:
                logger.info(f"[MH] Processing {len(attachments)} attachments...")
                attachment_info = self._process_attachments(attachments)
                message_type = attachment_info['type']
                image_urls = attachment_info['images']
                file_urls = attachment_info['files']
                audio_urls = attachment_info.get('audios', [])

                # Handle voice messages
                if audio_urls and self.openai_client:
                    # Check if voice transcription is enabled
                    voice_enabled = getattr(self.connection.ai_config, 'voice_transcription_enabled', True)
                    if voice_enabled:
                        logger.info("[MH] Voice message detected!")
                        for audio_url in audio_urls:
                            transcription = self._transcribe_voice_message(audio_url)
                            if transcription:
                                voice_transcription = transcription
                                processed_content = transcription
                                message_type = 'voice'
                                logger.info(f"[MH] Transcription: {transcription[:100]}...")
                    else:
                        logger.info("[MH] Voice transcription disabled - skipping")
                
                # Handle images
                if image_urls and self.openai_client:
                    for img_url in image_urls:
                        img_analysis = self._analyze_image_with_knowledge_base(
                            img_url, 
                            message_text or "What is this?",
                            conversation
                        )
                        if img_analysis:
                            image_analysis_result = img_analysis
            
            # Process URLs in text
            if message_text:
                extracted_urls = self._extract_urls(message_text)
                for url in extracted_urls:
                    if self._is_image_url(url):
                        img_analysis = self._analyze_image_with_knowledge_base(
                            url, message_text, conversation
                        )
                        if img_analysis:
                            image_analysis_result = img_analysis
                    else:
                        url_content = self._process_urls([url])
                        if url_content:
                            processed_content += f"\n\n[URL Content]: {url_content}"
            
            # Save user message
            user_message = Message.objects.create(
                conversation=conversation,
                sender='user',
                message_type=message_type,
                text=voice_transcription or message_text or "[Attachment]",
                image_url=image_urls[0] if image_urls else None,
                file_url=audio_urls[0] if audio_urls else (file_urls[0] if file_urls else None),
                image_description=image_analysis_result.get('image_description') if image_analysis_result else None,
                timestamp=timezone.now()
            )
            
            # Update conversation
            conversation.message_count += 1
            conversation.last_message_at = timezone.now()
            conversation.save()
            
            # ===== DETECT IMPORTANT MESSAGE AND CREATE NOTIFICATION =====
            self._detect_and_create_notification(
                message_text=message_text or "",
                user_message=user_message,
                conversation=conversation,
                image_description=image_analysis_result.get('image_description') if image_analysis_result else None
            )
            
            # Check auto-reply - skip if disabled globally or human takeover is active
            if not self.connection.auto_reply_enabled:
                logger.info("[MH] Auto-reply is disabled globally")
                return True

            if conversation.human_takeover:
                logger.info("[MH] Human takeover active for this conversation - skipping AI reply")
                return True

            # Generate response
            logger.info("[MH] Generating AI response...")
            start_time = time.time()
            
            if image_analysis_result and image_analysis_result.get('response'):
                response_data = image_analysis_result
            else:
                response_data = self._generate_response(processed_content or message_text, conversation)
            
            processing_time = time.time() - start_time
            logger.info(f"[MH] Response generated in {processing_time:.2f}s")
            
            response_text = response_data['response']
            
            # Check if voice reply is enabled
            voice_reply_enabled = getattr(self.connection.ai_config, 'voice_reply_enabled', False)
            voice_model = getattr(self.connection.ai_config, 'voice_model', 'nova')
            
            # Save bot message
            bot_message = Message.objects.create(
                conversation=conversation,
                sender='bot',
                message_type='voice' if voice_reply_enabled else 'text',
                text=response_text,
                model_used=response_data.get('model'),
                tokens_used=response_data.get('tokens', 0),
                processing_time=processing_time,
                rag_context_used=response_data.get('context_used', ''),
                timestamp=timezone.now()
            )
            
            conversation.message_count += 1
            conversation.save()
            
            # Send response
            logger.info("[MH] Sending response to Facebook...")

            if voice_reply_enabled:
                # Generate and send voice response
                logger.info(f"[MH] Generating voice response with '{voice_model}' voice...")
                audio_bytes = self._generate_voice_response(response_text, voice_model)
                
                if audio_bytes:
                    success = self._send_voice_message(sender_id, audio_bytes)
                    # Also send text version as fallback
                    if success:
                        self._send_facebook_message(sender_id, f"📝 {response_text[:200]}...")
                else:
                    # Fallback to text if voice generation fails
                    logger.warning("[MH] Voice generation failed, sending text...")
                    success = self._send_facebook_message(sender_id, response_text)
            else:
                # Send text response
                success = self._send_facebook_message(sender_id, response_text)

            if success:
                bot_message.delivered = True
                bot_message.save()
                logger.info("[MH] Response sent successfully!")
            else:
                bot_message.failed = True
                bot_message.error_message = "Failed to send"
                bot_message.save()
                logger.error("[MH] Failed to send response")

            return success

        except Exception as e:
            logger.error(f"[MH] Error processing message: {e}", exc_info=True)
            return False
    
    def _detect_and_create_notification(
        self, 
        message_text: str, 
        user_message: Message,
        conversation: Conversation,
        image_description: str = None
    ):
        """
        Detect if message is important and create notification
        Uses AI for smart detection, falls back to keywords
        """
        try:
            if not message_text and not image_description:
                return
            
            content_to_analyze = message_text
            if image_description:
                content_to_analyze += f" [Image shows: {image_description}]"
            
            # Try AI-based detection first
            notification_data = None
            if self.openai_client:
                notification_data = self._ai_detect_importance(content_to_analyze)
            
            # Fallback to keyword detection
            if not notification_data:
                notification_data = self._keyword_detect_importance(content_to_analyze)
            
            # Create notification if important
            if notification_data and notification_data.get('is_important'):
                sender_name = conversation.sender_name or conversation.sender_id
                
                Notification.objects.create(
                    connection=self.connection,
                    conversation=conversation,
                    message=user_message,
                    notification_type=notification_data.get('type', 'general'),
                    title=notification_data.get('title', f"Message from {sender_name}"),
                    summary=notification_data.get('summary', message_text[:200]),
                    priority=notification_data.get('priority', 'medium'),
                    is_read=False,
                    is_resolved=False
                )
                logger.info(f"Created notification: {notification_data.get('type')} - {notification_data.get('title')}")
        
        except Exception as e:
            logger.error(f"Error creating notification: {e}")
    
    def _ai_detect_importance(self, message_text: str) -> Optional[Dict]:
        """Use AI to detect if message is important"""
        try:
            import openai
            openai.api_key = self.connection.ai_config.openai_api_key
            
            detection_prompt = """Analyze this customer message and determine if it requires business attention.

Message: "{message}"

Respond in JSON format only:
{{
    "is_important": true/false,
    "type": "product_inquiry" | "appointment" | "order" | "urgent" | "complaint" | "pricing" | "availability" | "contact" | "general",
    "priority": "high" | "medium" | "low",
    "title": "Brief title (max 50 chars)",
    "summary": "Brief summary of what the customer wants (max 100 chars)"
}}

Important messages include:
- Product purchase inquiries
- Appointment/meeting requests  
- Order confirmations
- Urgent requests
- Complaints or issues
- Pricing questions
- Stock/availability checks
- Contact/location requests

General greetings or casual chat are NOT important."""

            response = openai.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "user", "content": detection_prompt.format(message=message_text)}
                ],
                max_tokens=200,
                temperature=0.1
            )
            
            result_text = response.choices[0].message.content.strip()
            
            # Parse JSON from response
            import json
            # Clean up response if needed
            if result_text.startswith('```'):
                result_text = result_text.split('```')[1]
                if result_text.startswith('json'):
                    result_text = result_text[4:]
            result_text = result_text.strip()
            
            result = json.loads(result_text)
            return result
        
        except Exception as e:
            logger.warning(f"AI detection failed, using keyword fallback: {e}")
            return None
    
    def _keyword_detect_importance(self, message_text: str) -> Optional[Dict]:
        """Fallback keyword-based importance detection"""
        message_lower = message_text.lower()
        
        for msg_type, keywords in IMPORTANT_KEYWORDS.items():
            for keyword in keywords:
                if keyword.lower() in message_lower:
                    # Determine priority
                    priority = 'medium'
                    if msg_type in ['urgent', 'complaint', 'order']:
                        priority = 'high'
                    elif msg_type in ['contact', 'general']:
                        priority = 'low'
                    
                    return {
                        'is_important': True,
                        'type': msg_type,
                        'priority': priority,
                        'title': f"{msg_type.replace('_', ' ').title()} detected",
                        'summary': message_text[:100]
                    }
        
        return None
    
    def _get_or_create_conversation(self, sender_id: str) -> Conversation:
        """Get or create conversation with user info fetching"""
        conversation, created = Conversation.objects.get_or_create(
            connection=self.connection,
            sender_id=sender_id,
            defaults={
                'is_active': True,
                'message_count': 0
            }
        )
        
        # Fetch user info if missing
        if not conversation.sender_name or created:
            logger.info(f"[MH] Fetching user info for: {sender_id}")
            user_info = self._get_facebook_user_info(sender_id)
            if user_info:
                name = user_info.get('name')
                profile_pic = user_info.get('profile_pic', '')

                if name:
                    conversation.sender_name = name
                    conversation.sender_profile_pic = profile_pic
                    conversation.save()
                    logger.info(f"[MH] User info saved: {conversation.sender_name}")
                else:
                    logger.warning("[MH] No name found in user info")
            else:
                logger.warning("[MH] Could not fetch user info")
        
        return conversation
    
    def _get_facebook_user_info(self, user_id: str) -> dict:
        """
        Get user information from Facebook Graph API
        Tries multiple methods for better success rate
        """
        if not self.page_access_token:
            logger.warning("No page access token!")
            return {}
        
        # Method 1: Standard user profile request
        user_info = self._try_get_user_info_v1(user_id)
        if user_info and user_info.get('name'):
            return user_info
        
        # Method 2: Try with different fields
        user_info = self._try_get_user_info_v2(user_id)
        if user_info and user_info.get('name'):
            return user_info
        
        # Method 3: Try conversations API
        user_info = self._try_get_user_from_conversations(user_id)
        if user_info and user_info.get('name'):
            return user_info
        
        logger.warning(f"Could not fetch user info for {user_id}")
        return {}
    
    def _try_get_user_info_v1(self, user_id: str) -> dict:
        """Standard Graph API user info request"""
        try:
            url = f"https://graph.facebook.com/v18.0/{user_id}"
            params = {
                'fields': 'name,first_name,last_name,profile_pic',
                'access_token': self.page_access_token
            }
            
            response = requests.get(url, params=params, timeout=10)
            logger.info(f"User info v1 response: {response.status_code}")
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.debug(f"V1 failed: {response.text}")
                return {}
        except Exception as e:
            logger.debug(f"V1 error: {e}")
            return {}
    
    def _try_get_user_info_v2(self, user_id: str) -> dict:
        """Try with minimal fields"""
        try:
            url = f"https://graph.facebook.com/v18.0/{user_id}"
            params = {
                'fields': 'first_name,last_name',
                'access_token': self.page_access_token
            }
            
            response = requests.get(url, params=params, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                # Combine first and last name
                name = f"{data.get('first_name', '')} {data.get('last_name', '')}".strip()
                if name:
                    data['name'] = name
                return data
            return {}
        except Exception as e:
            logger.debug(f"V2 error: {e}")
            return {}
    
    def _try_get_user_from_conversations(self, user_id: str) -> dict:
        """Try to get user info from page conversations"""
        try:
            # Get conversations from page
            url = f"https://graph.facebook.com/v18.0/{self.connection.page_id}/conversations"
            params = {
                'fields': 'participants',
                'access_token': self.page_access_token
            }
            
            response = requests.get(url, params=params, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                for conv in data.get('data', []):
                    for participant in conv.get('participants', {}).get('data', []):
                        if participant.get('id') == user_id:
                            return {
                                'name': participant.get('name'),
                                'id': participant.get('id')
                            }
            return {}
        except Exception as e:
            logger.debug(f"Conversations API error: {e}")
            return {}
    
    def _analyze_image_with_knowledge_base(
        self, 
        image_url: str, 
        user_question: str,
        conversation: Conversation
    ) -> Optional[Dict]:
        """Analyze image with AI and match with knowledge base"""
        if not self.openai_client or not hasattr(self.connection, 'ai_config'):
            return None
        
        try:
            if not self.connection.ai_config.image_understanding_enabled:
                return None
            
            # Get image description
            image_description = self._get_detailed_image_description(image_url)
            if not image_description:
                return None
            
            # Search knowledge base
            search_query = f"{user_question} {image_description}"
            context_text = ""
            
            if self.rag_engine and self.connection.ai_config.rag_enabled:
                relevant_chunks = self.rag_engine.retrieve_relevant_chunks(
                    search_query, self.connection
                )
                if relevant_chunks:
                    context_parts = [f"[{c['filename']}]\n{c['text']}" for c in relevant_chunks]
                    context_text = "\n\n".join(context_parts)
            
            # Generate response
            response = self._generate_image_response_with_context(
                image_url, image_description, user_question, context_text, conversation
            )
            
            return {
                'response': response.get('content', "I see the image."),
                'image_description': image_description,
                'context_used': context_text,
                'model': response.get('model', 'gpt-4o'),
                'tokens': response.get('tokens', 0)
            }
        except Exception as e:
            logger.error(f"Image analysis error: {e}")
            return None
    
    def _get_detailed_image_description(self, image_url: str) -> Optional[str]:
        """Get detailed image description using GPT-4o Vision"""
        try:
            import openai
            openai.api_key = self.connection.ai_config.openai_api_key
            
            # Download image and convert to base64 for Facebook CDN images
            image_data = self._get_image_for_openai(image_url)
            if not image_data:
                logger.warning("[MH] Could not load image for analysis")
                return None
            
            response = openai.chat.completions.create(
                model="gpt-4o",
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": """Analyze this image in detail:
1. What type of content? (screenshot, photo, product, document)
2. Main subject/content
3. If product: brand, features, specifications, price if visible
4. If screenshot: extract all visible text
5. Any other relevant details"""},
                        {"type": "image_url", "image_url": image_data}
                    ]
                }],
                max_tokens=1000
            )
            logger.info("[MH] Image analyzed successfully")
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"[MH] Image description error: {e}")
            return None
    
    def _get_image_for_openai(self, image_url: str) -> Optional[dict]:
        """
        Download image and prepare for OpenAI Vision API
        Facebook CDN images require download and base64 conversion
        """
        try:
            # Check if it's a Facebook CDN URL
            if 'fbcdn.net' in image_url or 'facebook.com' in image_url:
                logger.info("[MH] Downloading Facebook image...")

                # Download the image
                response = requests.get(image_url, timeout=30)
                if response.status_code != 200:
                    logger.error(f"[MH] Failed to download image: {response.status_code}")
                    return None
                
                # Detect content type
                content_type = response.headers.get('content-type', 'image/jpeg')
                if 'png' in content_type:
                    media_type = 'image/png'
                elif 'gif' in content_type:
                    media_type = 'image/gif'
                elif 'webp' in content_type:
                    media_type = 'image/webp'
                else:
                    media_type = 'image/jpeg'
                
                # Convert to base64
                image_base64 = base64.b64encode(response.content).decode('utf-8')
                logger.info(f"[MH] Image downloaded and converted to base64 ({len(response.content)} bytes)")
                
                return {
                    "url": f"data:{media_type};base64,{image_base64}",
                    "detail": "high"
                }
            else:
                # Non-Facebook URL - use directly
                return {"url": image_url, "detail": "high"}
                
        except Exception as e:
            logger.error(f"[MH] Error preparing image: {e}")
            return None
    
    def _transcribe_voice_message(self, audio_url: str) -> Optional[str]:
        """
        Transcribe voice message using OpenAI Whisper API
        Supports: mp3, mp4, mpeg, mpga, m4a, wav, webm, ogg
        """
        try:
            logger.info("[MH] Transcribing voice message...")

            # Download audio from Facebook
            logger.info(f"[MH] Downloading audio from: {audio_url[:50]}...")
            response = requests.get(audio_url, timeout=30)

            if response.status_code != 200:
                logger.error(f"[MH] Failed to download audio: {response.status_code}")
                return None
            
            # Determine file extension from content-type
            content_type = response.headers.get('content-type', 'audio/mpeg')
            if 'ogg' in content_type:
                ext = 'ogg'
            elif 'mp4' in content_type or 'm4a' in content_type:
                ext = 'mp4'
            elif 'wav' in content_type:
                ext = 'wav'
            elif 'webm' in content_type:
                ext = 'webm'
            else:
                ext = 'mp3'
            
            # Save to temporary file
            import tempfile
            import os
            
            with tempfile.NamedTemporaryFile(suffix=f'.{ext}', delete=False) as temp_file:
                temp_file.write(response.content)
                temp_path = temp_file.name
            
            logger.info(f"[MH] Audio saved temporarily ({len(response.content)} bytes)")
            
            try:
                # Transcribe using OpenAI Whisper
                import openai
                openai.api_key = self.connection.ai_config.openai_api_key
                
                with open(temp_path, 'rb') as audio_file:
                    # Don't specify language - let Whisper auto-detect
                    # Whisper supports 97+ languages including Bengali
                    transcript = openai.audio.transcriptions.create(
                        model="whisper-1",
                        file=audio_file
                        # language parameter removed for auto-detection
                    )
                
                transcribed_text = transcript.text
                logger.info(f"[MH] Transcription successful: {transcribed_text[:100]}...")
                
                return transcribed_text
                
            finally:
                # Clean up temp file
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                    
        except Exception as e:
            logger.error(f"[MH] Voice transcription error: {e}", exc_info=True)
            return None
    
    def _generate_voice_response(self, text: str, voice: str = "nova") -> Optional[bytes]:
        """
        Generate voice response using OpenAI TTS API
        Voices: alloy, echo, fable, onyx, nova, shimmer
        """
        try:
            logger.info("[MH] Generating voice response...")

            import openai
            openai.api_key = self.connection.ai_config.openai_api_key
            
            response = openai.audio.speech.create(
                model="tts-1",  # or "tts-1-hd" for higher quality
                voice=voice,
                input=text
            )
            
            audio_bytes = response.content
            logger.info(f"[MH] Voice generated ({len(audio_bytes)} bytes)")

            return audio_bytes

        except Exception as e:
            logger.error(f"[MH] Voice generation error: {e}")
            return None
    
    def _send_voice_message(self, recipient_id: str, audio_bytes: bytes) -> bool:
        """Send voice message to Facebook Messenger"""
        try:
            import tempfile
            import os
            
            # Save audio to temp file
            with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as temp_file:
                temp_file.write(audio_bytes)
                temp_path = temp_file.name
            
            try:
                # Upload to Facebook
                url = "https://graph.facebook.com/v18.0/me/messages"
                
                with open(temp_path, 'rb') as audio_file:
                    files = {
                        'filedata': ('voice.mp3', audio_file, 'audio/mpeg')
                    }
                    data = {
                        'recipient': json.dumps({'id': recipient_id}),
                        'message': json.dumps({
                            'attachment': {
                                'type': 'audio',
                                'payload': {'is_reusable': False}
                            }
                        }),
                        'messaging_type': 'RESPONSE'
                    }
                    params = {'access_token': self.page_access_token}
                    
                    response = requests.post(url, data=data, files=files, params=params, timeout=30)
                
                if response.status_code == 200:
                    logger.info("[MH] Voice message sent!")
                    return True
                else:
                    logger.error(f"[MH] Failed to send voice: {response.text}")
                    return False
                    
            finally:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                    
        except Exception as e:
            logger.error(f"[MH] Send voice error: {e}")
            return False
    
    def _generate_image_response_with_context(
        self, image_url: str, image_description: str,
        user_question: str, knowledge_context: str, conversation: Conversation
    ) -> Dict:
        """Generate response combining image analysis with knowledge base"""
        try:
            import openai
            openai.api_key = self.connection.ai_config.openai_api_key
            
            active_prompt = self.connection.prompts.filter(is_active=True).first()
            system_prompt = active_prompt.system_prompt if active_prompt else "You are a helpful business assistant."
            
            if knowledge_context:
                user_content = f"""User question: "{user_question}"

Image analysis: {image_description}

Company knowledge:
{knowledge_context}

Provide helpful response using company information."""
            else:
                user_content = f"""User question: "{user_question}"

Image analysis: {image_description}

Provide helpful response."""
            
            # Get image data for OpenAI
            image_data = self._get_image_for_openai(image_url)
            
            if image_data:
                # Use image in response
                response = openai.chat.completions.create(
                    model=self.connection.ai_config.openai_model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": [
                            {"type": "text", "text": user_content},
                            {"type": "image_url", "image_url": image_data}
                        ]}
                    ],
                    temperature=self.connection.ai_config.temperature,
                    max_tokens=self.connection.ai_config.max_tokens
                )
            else:
                # No image data - text only response
                response = openai.chat.completions.create(
                    model=self.connection.ai_config.openai_model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_content}
                    ],
                    temperature=self.connection.ai_config.temperature,
                    max_tokens=self.connection.ai_config.max_tokens
                )
            
            return {
                'content': response.choices[0].message.content,
                'model': response.model,
                'tokens': response.usage.total_tokens
            }
        except Exception as e:
            logger.error(f"[MH] Image response error: {e}")
            return {'content': "I see your image. How can I help?", 'model': 'error', 'tokens': 0}
    
    def _process_attachments(self, attachments: List) -> Dict:
        """Process message attachments"""
        result = {
            'type': 'file', 
            'images': [], 
            'files': [], 
            'audios': [],  # Added for voice messages
            'videos': [],  # Added for video messages
            'location': None, 
            'sticker_id': None
        }
        
        for attachment in attachments:
            payload = attachment.get('payload', {})
            attach_type = attachment.get('type', '')
            url = payload.get('url')
            
            if attach_type == 'image' and url:
                result['type'] = 'image'
                result['images'].append(url)
            elif attach_type == 'audio' and url:
                result['type'] = 'audio'
                result['audios'].append(url)
            elif attach_type == 'video' and url:
                result['type'] = 'video'
                result['videos'].append(url)
            elif attach_type == 'file' and url:
                result['type'] = 'file'
                result['files'].append(url)
            elif attach_type == 'location':
                result['type'] = 'location'
                result['location'] = payload.get('coordinates', {})
            elif attach_type == 'sticker':
                result['type'] = 'sticker'
                result['sticker_id'] = payload.get('sticker_id')
        
        return result
    
    def _extract_urls(self, text: str) -> List[str]:
        """Extract URLs from text"""
        if not text:
            return []
        urls = self.URL_PATTERN.findall(text)
        return [f'https://{u}' if not u.startswith('http') else u for u in set(urls)]
    
    def _process_urls(self, urls: List[str]) -> str:
        """Extract content from URLs"""
        summaries = []
        for url in urls[:3]:
            if self._is_image_url(url):
                continue
            try:
                response = requests.get(url, timeout=10, headers={'User-Agent': 'Mozilla/5.0'})
                if response.status_code == 200:
                    from bs4 import BeautifulSoup
                    soup = BeautifulSoup(response.content, 'html.parser')
                    title = soup.find('title')
                    summaries.append(f"Title: {title.text if title else 'N/A'}")
            except:
                pass
        return '\n'.join(summaries)
    
    def _is_image_url(self, url: str) -> bool:
        """Check if URL is an image"""
        try:
            return any(urlparse(url).path.lower().endswith(ext) for ext in self.IMAGE_EXTENSIONS)
        except:
            return False
    
    def _generate_response(self, message_text: str, conversation: Conversation) -> dict:
        """Generate AI response using RAG"""
        try:
            if self.rag_engine:
                recent_messages = Message.objects.filter(
                    conversation=conversation
                ).order_by('-timestamp')[:10]
                
                history = []
                for msg in reversed(recent_messages):
                    content = msg.text or ""
                    if msg.image_description:
                        content += f" [Image: {msg.image_description}]"
                    if content:
                        history.append({
                            'role': 'user' if msg.sender == 'user' else 'assistant',
                            'content': content
                        })
                
                return self.rag_engine.generate_response(
                    query=message_text,
                    connection=self.connection,
                    conversation_history=history[:-1] if history else []
                )
            else:
                return {
                    'response': self.connection.greeting_text or "Hi! How can I help?",
                    'model': 'none', 'tokens': 0, 'context_used': ''
                }
        except Exception as e:
            logger.error(f"Response generation error: {e}")
            return {'response': "Sorry, an error occurred.", 'model': 'error', 'tokens': 0, 'context_used': ''}
    
    def _send_facebook_message(self, recipient_id: str, message_text: str) -> bool:
        """Send message to Facebook user"""
        try:
            url = "https://graph.facebook.com/v18.0/me/messages"
            
            messages = [message_text[i:i+2000] for i in range(0, len(message_text), 2000)] if len(message_text) > 2000 else [message_text]
            
            for msg in messages:
                response = requests.post(
                    url,
                    json={
                        'recipient': {'id': recipient_id},
                        'message': {'text': msg},
                        'messaging_type': 'RESPONSE'
                    },
                    params={'access_token': self.page_access_token},
                    timeout=10
                )
                if response.status_code != 200:
                    logger.error(f"Send failed: {response.text}")
                    return False
                time.sleep(0.5)
            
            return True
        except Exception as e:
            logger.error(f"Send error: {e}")
            return False


def update_all_conversation_user_info(connection: MessengerConnection):
    """Update user info for all conversations"""
    handler = MessageHandler(connection)
    conversations = Conversation.objects.filter(connection=connection)
    
    updated = 0
    for conv in conversations:
        if not conv.sender_name:
            user_info = handler._get_facebook_user_info(conv.sender_id)
            if user_info and user_info.get('name'):
                conv.sender_name = user_info.get('name')
                conv.sender_profile_pic = user_info.get('profile_pic')
                conv.save()
                updated += 1
        time.sleep(0.5)
    
    return updated
