# 🔧 Configuration Template - Messenger Automation

## Environment Variables (.env)

```env
# Facebook Configuration
FACEBOOK_PAGE_ID=your_page_id_here
FACEBOOK_PAGE_ACCESS_TOKEN=your_page_access_token_here
FACEBOOK_VERIFY_TOKEN=your_verify_token_here

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Django Settings
DEBUG=False
SECRET_KEY=your_secret_key_here
ALLOWED_HOSTS=localhost,127.0.0.1,yourdomain.com

# Database (if using different DB)
DATABASE_URL=mysql://user:password@localhost:3306/socialync
```

---

## Django Settings Configuration

Add to `settings.py`:

```python
# ============================================================================
# MESSENGER BOT CONFIGURATION
# ============================================================================

MESSENGER_BOT_CONFIG = {
    # Image Recognition
    'ENABLE_IMAGE_RECOGNITION': True,
    'MAX_IMAGE_SIZE_MB': 10,
    'SUPPORTED_IMAGE_FORMATS': ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'],
    
    # URL Processing
    'ENABLE_URL_PROCESSING': True,
    'MAX_URLs_PER_MESSAGE': 3,
    'URL_FETCH_TIMEOUT': 10,  # seconds
    'MAX_URL_CONTENT_LENGTH': 5000,  # characters
    
    # Message Processing
    'MAX_MESSAGE_LENGTH': 2000,  # Split into chunks if longer
    'MESSAGE_SEND_DELAY': 0.5,  # seconds between sends
    
    # AI Configuration
    'DEFAULT_TEMPERATURE': 0.7,
    'DEFAULT_MAX_TOKENS': 500,
    'DEFAULT_TOP_K_RESULTS': 3,  # RAG retrieval
    'SIMILARITY_THRESHOLD': 0.7,
    
    # Conversation
    'CONVERSATION_HISTORY_LENGTH': 10,  # Last N messages
    'MAX_INACTIVE_DAYS': 30,  # Mark conversation as inactive
    
    # Error Handling
    'RETRY_FAILED_MESSAGES': True,
    'MAX_RETRIES': 3,
    'RETRY_DELAY_SECONDS': 5,
}

# ============================================================================
# LOGGING CONFIGURATION
# ============================================================================

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {asctime} {message}',
            'style': '{',
        },
    },
    'filters': {
        'require_debug_false': {
            '()': 'django.utils.log.RequireDebugFalse',
        },
        'require_debug_true': {
            '()': 'django.utils.log.RequireDebugTrue',
        },
    },
    'handlers': {
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'simple'
        },
        'file': {
            'level': 'DEBUG',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': 'logs/messenger_bot.log',
            'maxBytes': 1024 * 1024 * 10,  # 10MB
            'backupCount': 5,
            'formatter': 'verbose',
        },
        'error_file': {
            'level': 'ERROR',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': 'logs/messenger_bot_errors.log',
            'maxBytes': 1024 * 1024 * 10,  # 10MB
            'backupCount': 5,
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console', 'file', 'error_file'],
        'level': 'DEBUG',
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': False,
        },
        'messenger_bot': {
            'handlers': ['console', 'file', 'error_file'],
            'level': 'DEBUG',
            'propagate': False,
        },
    },
}

# ============================================================================
# CELERY CONFIGURATION (Optional - for async tasks)
# ============================================================================

CELERY_BROKER_URL = 'redis://localhost:6379/0'
CELERY_RESULT_BACKEND = 'redis://localhost:6379/0'
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'UTC'

# Long-running tasks timeout
CELERY_TASK_TIME_LIMIT = 30 * 60  # 30 minutes
CELERY_TASK_SOFT_TIME_LIMIT = 25 * 60  # 25 minutes

# ============================================================================
# CACHING CONFIGURATION (Optional - for URL content caching)
# ============================================================================

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': 'redis://127.0.0.1:6379/1',
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
        },
        'KEY_PREFIX': 'messenger_bot',
        'TIMEOUT': 3600,  # 1 hour default timeout
    }
}

# ============================================================================
# SECURITY SETTINGS
# ============================================================================

# HTTPS only (production)
SECURE_SSL_REDIRECT = not DEBUG
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG

# CORS Settings
CORS_ALLOWED_ORIGINS = [
    "https://yourdomain.com",
    "https://www.yourdomain.com",
]

# ============================================================================
# INSTALLED APPS (Ensure these are included)
# ============================================================================

INSTALLED_APPS = [
    # ... existing apps ...
    'messenger_bot',
    'ai_caption',
    'accounts',
    'platforms',
    'posts',
    'analytics',
    'rest_framework',
]
```

---

## Facebook App Configuration

### Permissions Required:
```
✅ pages_manage_metadata
✅ pages_read_user_profile
✅ pages_manage_messaging
✅ pages_read_engagement
✅ read_page_mailboxes
```

### Webhook Setup:

**Fields to Subscribe:**
```
✅ messages
✅ messaging_postbacks
✅ messaging_referrals
✅ messaging_optins
```

**Webhook URL Format:**
```
https://yourdomain.com/messenger/webhook/{page_id}/
```

---

## OpenAI Configuration

### API Key Setup:
```python
# Load from environment
import os
from decouple import config

OPENAI_API_KEY = config('OPENAI_API_KEY')

# Initialize client
from messenger_bot.services.openai_client import OpenAIClient
client = OpenAIClient(OPENAI_API_KEY)
```

### Model Selection:

**For Text + Image + Vision:**
```python
'gpt-4o'  # Best - most capable
'gpt-4o-mini'  # Good - faster & cheaper
'gpt-4-turbo'  # Legacy - still works
```

**For Embeddings:**
```python
'text-embedding-3-small'  # Recommended
'text-embedding-3-large'  # More powerful
'text-embedding-ada-002'  # Legacy
```

---

## Database Configuration

### MySQL Connection:
```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': 'socialync_messenger',
        'USER': 'root',
        'PASSWORD': 'your_password',
        'HOST': 'localhost',
        'PORT': '3306',
        'OPTIONS': {
            'charset': 'utf8mb4',
        }
    }
}
```

### Required Tables:
```sql
✅ messenger_connections
✅ ai_configurations
✅ pdf_knowledge_base
✅ pdf_chunks
✅ custom_prompts
✅ conversations
✅ messages
```

---

## URL Processing Configuration

### BeautifulSoup Configuration:

```python
# For HTML parsing
from bs4 import BeautifulSoup

# Supported parsers
PARSER = 'html.parser'  # or 'lxml', 'html5lib'

# Default timeout for URL fetching
URL_TIMEOUT = 10  # seconds

# Headers for requests
REQUEST_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

# Max content length
MAX_CONTENT_SIZE = 1024 * 1024  # 1MB
```

---

## Image Processing Configuration

### Image Analysis Settings:

```python
# GPT-4 Vision Configuration
IMAGE_ANALYSIS_CONFIG = {
    'MODEL': 'gpt-4o',
    'MAX_TOKENS': 500,
    'TEMPERATURE': 0.7,
    'PROMPT': 'Describe this image in detail. What do you see?',
}

# Supported formats
SUPPORTED_IMAGE_FORMATS = [
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'
]

# Size limits
MAX_IMAGE_SIZE = 20 * 1024 * 1024  # 20MB (API limit)
MAX_IMAGES_PER_MESSAGE = 10

# Quality settings
IMAGE_QUALITY = 85  # For JPEG compression
THUMBNAIL_SIZE = (200, 200)
```

---

## Rate Limiting Configuration

```python
# Message sending rate limits
RATE_LIMIT_CONFIG = {
    'MESSAGES_PER_SECOND': 2,
    'MESSAGES_PER_MINUTE': 100,
    'MESSAGES_PER_HOUR': 5000,
    
    'API_CALLS_PER_SECOND': 10,
    'API_CALLS_PER_MINUTE': 600,
    
    'DELAY_BETWEEN_SENDS': 0.5,  # seconds
    'RETRY_DELAY': 5,  # seconds
}
```

---

## Error Handling Configuration

```python
# Retry policy
ERROR_HANDLING = {
    'RETRY_FAILED_MESSAGES': True,
    'MAX_RETRIES': 3,
    'RETRY_DELAYS': [5, 10, 30],  # seconds
    
    'LOG_FULL_EXCEPTIONS': True,
    'LOG_REQUEST_BODY': True,
    'LOG_RESPONSE_BODY': True,
    
    'NOTIFY_ON_FAILURE': True,
    'FAILURE_NOTIFICATION_EMAIL': 'admin@yourdomain.com',
}
```

---

## Performance Tuning

```python
# Connection pooling
DATABASES['default']['CONN_MAX_AGE'] = 600

# Query optimization
DEBUG_QUERIES_ENABLED = DEBUG
DATABASE_QUERY_TIMEOUT = 30

# Cache settings
CACHE_TIMEOUT_URL_CONTENT = 3600  # 1 hour
CACHE_TIMEOUT_IMAGE_ANALYSIS = 86400  # 1 day
CACHE_TIMEOUT_USER_INFO = 3600  # 1 hour

# Worker settings (if using Celery)
CELERY_WORKER_PREFETCH_MULTIPLIER = 4
CELERY_WORKER_MAX_TASKS_PER_CHILD = 1000
```

---

## Development vs Production

### Development (.env.dev):
```env
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
SECURE_SSL_REDIRECT=False
ENABLE_URL_PROCESSING=True
ENABLE_IMAGE_RECOGNITION=True
```

### Production (.env.prod):
```env
DEBUG=False
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
SECURE_SSL_REDIRECT=True
ENABLE_URL_PROCESSING=True
ENABLE_IMAGE_RECOGNITION=True
DATABASE_URL=your_production_db
```

---

## Deployment Checklist

```
Pre-Deployment:
☐ All settings configured
☐ Environment variables set
☐ Database migrated
☐ Static files collected
☐ Security headers configured
☐ HTTPS certificate valid
☐ Rate limiting tested
☐ Error handling tested
☐ Logging configured

Monitoring:
☐ Error logs monitored
☐ API usage tracked
☐ Database performance checked
☐ Memory usage monitored
☐ Response times tracked

Maintenance:
☐ Database backups scheduled
☐ Log rotation configured
☐ Cache cleanup scheduled
☐ Old conversations archived
☐ Unused files cleaned
```

---

## Troubleshooting Configuration Issues

### Issue: "Connection refused" for database
```python
# Check database credentials
DATABASES['default']['HOST']
DATABASES['default']['PORT']
DATABASES['default']['NAME']
```

### Issue: "API rate limit exceeded"
```python
# Adjust rate limits
RATE_LIMIT_CONFIG['MESSAGES_PER_SECOND'] = 1
RATE_LIMIT_CONFIG['DELAY_BETWEEN_SENDS'] = 1.0
```

### Issue: "Image analysis timeout"
```python
# Increase timeout
URL_TIMEOUT = 30  # seconds
CELERY_TASK_TIME_LIMIT = 60 * 60  # 1 hour
```

### Issue: "Memory usage high"
```python
# Configure caching
CACHES['default']['OPTIONS']['CONNECTION_POOL_KWARGS'] = {
    'max_connections': 50,
    'retry_on_timeout': True,
}
```

---

**Last Updated:** January 19, 2026  
**Configuration Version:** 1.0.0  
**Status:** Ready for Production ✅
