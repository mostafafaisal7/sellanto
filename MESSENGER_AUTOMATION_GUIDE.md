# 🤖 Messenger Automation - Complete Setup Guide

## Overview
This complete messenger automation system includes:
- ✅ **Text Message Processing** - Intelligent responses with RAG
- ✅ **Image Recognition** - AI-powered image analysis (GPT-4 Vision)
- ✅ **URL Detection & Processing** - Automatic URL extraction and content analysis
- ✅ **Attachment Handling** - Support for images, files, videos, audio
- ✅ **Location & Stickers** - Complete attachment type support
- ✅ **Conversation Memory** - Context-aware responses
- ✅ **Auto-Reply** - Configurable automation

---

## 🚀 Installation & Setup

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

Key packages added:
- `beautifulsoup4` - HTML parsing for URL content extraction
- `openai>=2.14.0` - GPT-4 Vision for image analysis
- `requests` - HTTP requests for URLs and APIs

### 2. Database Migrations
```bash
python manage.py makemigrations
python manage.py migrate
```

---

## 🔧 Configuration

### A. Facebook Messenger Setup
1. Create Facebook App at https://developers.facebook.com
2. Get your:
   - **Page ID**
   - **Page Access Token** (with `pages_manage_metadata` permissions)
   - **Verify Token** (auto-generated or custom)

### B. OpenAI Configuration
1. Get API Key from https://platform.openai.com/api-keys
2. Required permissions:
   - `gpt-4o` or `gpt-4o-mini` (for text + vision)
   - `text-embedding-3-small` (for embeddings)

### C. Django Settings
Add to `settings.py`:
```python
# Messenger Bot Configuration
MESSENGER_BOT_CONFIG = {
    'ENABLE_IMAGE_RECOGNITION': True,
    'ENABLE_URL_PROCESSING': True,
    'MAX_URL_PER_MESSAGE': 3,
    'URL_FETCH_TIMEOUT': 10,  # seconds
}

# Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
        'file': {
            'class': 'logging.FileHandler',
            'filename': 'messenger_bot.log',
        },
    },
    'root': {
        'handlers': ['console', 'file'],
        'level': 'DEBUG',
    },
}
```

---

## 📝 Features Explained

### 1. Text Message Processing
```python
# Automatically processes text messages
# - Extracts content
# - Queries RAG knowledge base
# - Maintains conversation history
# - Generates contextual responses
```

### 2. Image Recognition
```python
# Process incoming images:
# 1. Detect image in attachments
# 2. Use GPT-4 Vision to analyze
# 3. Store description in database
# 4. Include analysis in AI response

Example:
User sends image → Bot analyzes → "This appears to be a cat sitting on a couch"
```

### 3. URL Detection & Processing
```python
# Detect URLs in messages using regex
# 1. Extract all URLs from text
# 2. Validate and format URLs
# 3. Fetch page content
# 4. Extract title, description, content
# 5. Summarize for AI context

Pattern matches:
- https://example.com
- www.example.com
- example.com
- Direct links in text
```

### 4. Attachment Types Supported
```python
{
    'image': 'JPG, PNG, GIF, WebP, SVG',
    'file': 'PDFs, Documents',
    'video': 'MP4, MOV, etc.',
    'audio': 'MP3, WAV, etc.',
    'location': 'GPS coordinates',
    'sticker': 'Custom stickers'
}
```

---

## 🎯 Message Flow

```
Facebook User sends message
    ↓
Webhook receives data
    ↓
Extract: text, attachments, sender_id
    ↓
[PARALLEL PROCESSING]
├─ Process attachments (images, files, location)
│  ├─ If image → Analyze with GPT-4 Vision
│  └─ Extract metadata
├─ Extract URLs from text
│  ├─ Validate URL format
│  ├─ Fetch content
│  └─ Parse HTML/metadata
└─ Save user message to database
    ↓
Combine processed content
    ↓
Generate AI Response
├─ Query RAG with context
├─ Include conversation history
└─ Include image/URL analysis
    ↓
Save bot response
    ↓
Send to Facebook Messenger
    ↓
Update conversation metadata
```

---

## 💻 Code Examples

### Processing a Message with Image
```python
from messenger_bot.services.message_handler import MessageHandler

# Initialize handler
handler = MessageHandler(connection)

# Process message with image attachment
result = handler.process_message(
    sender_id="123456789",
    message_data={
        'text': 'What do you think about this?',
        'attachments': [
            {
                'type': 'image',
                'payload': {
                    'url': 'https://example.com/image.jpg'
                }
            }
        ],
        'mid': 'mid_12345'
    }
)
```

### Extracting URLs
```python
urls = handler._extract_urls(
    "Check out https://example.com and www.google.com"
)
# Returns: ['https://example.com', 'https://www.google.com']
```

### Analyzing Image
```python
description = handler._analyze_image_with_ai(
    "https://example.com/photo.jpg"
)
# Returns: "A sunset over mountains with warm orange and pink colors..."
```

---

## 🔐 Security Considerations

### 1. Token Management
```python
# Never hardcode tokens
import os
from decouple import config

PAGE_ACCESS_TOKEN = config('FACEBOOK_PAGE_ACCESS_TOKEN')
OPENAI_API_KEY = config('OPENAI_API_KEY')
VERIFY_TOKEN = config('MESSENGER_VERIFY_TOKEN')
```

### 2. Webhook Verification
```python
# Always verify incoming requests
if token != connection.verify_token:
    return JsonResponse({'error': 'Unauthorized'}, status=403)
```

### 3. Rate Limiting
```python
# Bot includes delays to avoid rate limiting
time.sleep(0.5)  # Between messages
timeout=10  # Request timeout
```

### 4. Input Validation
```python
# Validate all external inputs
- Check sender_id format
- Validate attachment types
- Sanitize URLs before fetching
- Limit content length
```

---

## 🧪 Testing

### Unit Test Example
```python
from django.test import TestCase
from messenger_bot.services.message_handler import MessageHandler

class MessageHandlerTest(TestCase):
    def test_extract_urls(self):
        handler = MessageHandler(self.connection)
        
        urls = handler._extract_urls(
            "Visit https://example.com for more"
        )
        
        self.assertEqual(len(urls), 1)
        self.assertIn('example.com', urls[0])
    
    def test_image_detection(self):
        result = handler._process_attachments([
            {
                'type': 'image',
                'payload': {'url': 'https://example.com/img.jpg'}
            }
        ])
        
        self.assertEqual(result['type'], 'image')
        self.assertEqual(len(result['images']), 1)
```

### Integration Test
```python
# Test complete message flow with mock
from unittest.mock import patch

@patch('requests.post')  # Mock Facebook API
@patch('requests.get')   # Mock URL fetching
def test_complete_message_flow(mock_get, mock_post):
    # Setup mocks
    mock_post.return_value.status_code = 200
    mock_get.return_value.status_code = 200
    
    # Send message
    result = handler.process_message(
        sender_id="test_user",
        message_text="Visit https://example.com"
    )
    
    self.assertTrue(result)
```

---

## 📊 Database Models

### Message Model
```python
Message(
    conversation=Conversation,
    sender='user'|'bot',
    message_type='text'|'image'|'file'|'video'|'audio'|'sticker'|'location',
    text=str,
    image_url=str,        # URL to image
    image_description=str, # AI analysis
    file_url=str,
    rag_context_used=str, # Retrieved knowledge base content
    model_used=str,       # 'gpt-4o', 'gpt-4o-mini', etc.
    tokens_used=int,
    processing_time=float,
    delivered=bool,
    timestamp=DateTime
)
```

---

## 🐛 Troubleshooting

### Image Analysis Not Working
```python
# Check 1: Image understanding enabled
connection.ai_config.image_understanding_enabled  # Must be True

# Check 2: Valid OpenAI API key
openai_client = OpenAIClient(api_key)

# Check 3: Image URL is accessible
response = requests.get(image_url)
# Should return 200

# Check 4: Using vision-capable model
# Must be: gpt-4o, gpt-4o-mini, gpt-4-turbo (not 3.5)
```

### URL Processing Issues
```python
# Check 1: BeautifulSoup installed
try:
    from bs4 import BeautifulSoup
except ImportError:
    # Install: pip install beautifulsoup4
    
# Check 2: URL format valid
import re
if not MessageHandler.URL_PATTERN.match(url):
    # URL format invalid
    
# Check 3: Website allows requests
response = requests.get(url, timeout=10)
if response.status_code != 200:
    # Website blocked or error
```

### Messages Not Sending
```python
# Check 1: Page access token valid
curl -X GET "https://graph.facebook.com/me?access_token=TOKEN"

# Check 2: Recipient ID valid
# Must be actual Facebook user ID, not username

# Check 3: Rate limiting
# Add delays between messages
time.sleep(0.5)

# Check 4: Message length
# Facebook limit: 2000 characters
# Bot handles splitting automatically
```

---

## 🚦 Performance Optimization

### 1. Parallel Processing
```python
# URL fetching and image analysis run independently
# Not blocking each other
```

### 2. Caching
```python
# Cache frequently accessed URLs
from django.core.cache import cache

cache.set(f'url_content_{url_hash}', content, timeout=3600)
```

### 3. Batch Requests
```python
# Process multiple embeddings in one API call
embeddings = openai_client.create_embeddings_batch(texts)
```

### 4. Async Tasks
```python
# Use Celery for long-running tasks
from celery import shared_task

@shared_task
def analyze_image_async(image_url, message_id):
    description = analyze_image(image_url)
    save_to_message(message_id, description)
```

---

## 📈 Monitoring & Analytics

### Key Metrics to Track
```python
{
    'messages_processed': int,
    'avg_response_time': float,  # seconds
    'images_analyzed': int,
    'urls_extracted': int,
    'failed_messages': int,
    'tokens_used': int,
    'api_costs': float,
}
```

### Dashboard Query
```python
from django.db.models import Count, Avg, Sum
from messenger_bot.models import Message

stats = Message.objects.aggregate(
    total=Count('id'),
    avg_time=Avg('processing_time'),
    total_tokens=Sum('tokens_used'),
    image_count=Count('image_url', filter=Q(image_url__isnull=False))
)
```

---

## 🎓 Advanced Usage

### Custom System Prompts
```python
# Set AI personality via CustomPrompt model
CustomPrompt.objects.create(
    connection=connection,
    name="Customer Support Bot",
    system_prompt="You are a helpful customer support specialist...",
    tone="support",
    is_active=True
)
```

### Knowledge Base (RAG)
```python
# Upload PDFs for context
pdf = PDFKnowledgeBase.objects.create(
    connection=connection,
    file=pdf_file,
    filename='company_handbook.pdf',
    status='pending'
)

# Automatically vectorized and indexed
# AI retrieves relevant sections for responses
```

### Quick Replies
```python
# Send interactive buttons (future enhancement)
handler._send_facebook_message(
    recipient_id,
    message_text,
    quick_replies=[
        {'title': 'Yes', 'payload': 'YES'},
        {'title': 'No', 'payload': 'NO'},
    ]
)
```

---

## 📚 API Reference

### MessageHandler Class

#### Methods:
```python
process_message(sender_id, message_data, message_text, attachments, message_id)
_process_attachments(attachments)
_extract_urls(text)
_process_urls(urls)
_analyze_image_with_ai(image_url)
_generate_response(message_text, conversation)
_send_facebook_message(recipient_id, message_text, quick_replies)
_get_facebook_user_info(user_id)
_get_or_create_conversation(sender_id)
```

### OpenAIClient Class

#### Methods:
```python
create_embedding(text, model)
create_embeddings_batch(texts, model)
chat_completion(messages, model, temperature, max_tokens)
analyze_image(image_url, prompt, model, max_tokens)
vision_analysis(image_url, prompt, model)
```

---

## 🔗 Useful Links

- [Facebook Messenger API](https://developers.facebook.com/docs/messenger-platform)
- [OpenAI API Docs](https://platform.openai.com/docs/api-reference)
- [GPT-4 Vision](https://platform.openai.com/docs/guides/vision)
- [RAG Implementation](https://openai.com/docs/guides/prompt-engineering/rag)

---

## 📞 Support & Issues

### Common Issues:
1. **"Connection not found"** - Page ID mismatch
2. **"Invalid verify token"** - Token not matching
3. **"Image analysis failed"** - API key or image URL issue
4. **"URL timeout"** - Website unreachable or timeout too short

### Debug Mode:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger('messenger_bot')
```

---

## ✅ Checklist for Deployment

- [ ] All dependencies installed (`pip install -r requirements.txt`)
- [ ] Environment variables configured (API keys, tokens)
- [ ] Database migrations applied
- [ ] Facebook webhook verified
- [ ] OpenAI API key tested
- [ ] BeautifulSoup4 installed for URL parsing
- [ ] Image recognition enabled in AI config
- [ ] Logging configured
- [ ] Error handling tested
- [ ] Rate limiting configured
- [ ] Security tokens secured
- [ ] Load testing completed

---

**Created:** January 19, 2026
**Version:** 1.0.0
**Status:** Production Ready ✅
