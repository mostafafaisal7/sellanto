# C:\Users\Trust computer\Desktop\Final_version_socialSync\socialsync\settings.py

import os
from decouple import config, Csv
from pathlib import Path

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# API Key Configuration (fallbacks - users should set keys via Settings page)
OPENAI_API_KEY = config('OPENAI_API_KEY', default='')
GEMINI_API_KEY = config('GEMINI_API_KEY', default='')
ANTHROPIC_API_KEY = config('test', default='')

# ─── Facebook OAuth ───────────────────────────────────────────────────────────
FACEBOOK_APP_ID      = config('FACEBOOK_APP_ID', default='')
FACEBOOK_APP_SECRET  = config('FACEBOOK_APP_SECRET', default='')
FACEBOOK_REDIRECT_URI = config(
    'FACEBOOK_REDIRECT_URI',
    default='http://localhost:8000/api/v1/platforms/facebook/callback/'
)
FRONTEND_URL = config('FRONTEND_URL', default='http://localhost:3000')
# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = config('DJANGO_SECRET_KEY', default='django-insecure-rf#m85xc6pefl#85gx(-g)%w)2_*_eg5*26ovyanr!7n%8vhm=')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = config('DJANGO_DEBUG', default=True, cast=bool)

ALLOWED_HOSTS = [
    '127.0.0.1',
    'localhost',
    'abedintechllc.com',
    'www.abedintechllc.com',
    'lorilee-neediest-zina.ngrok-free.dev',
    'frances-vegetative-vincent.ngrok-free.dev',
     
]

CSRF_TRUSTED_ORIGINS = [
    'https://abedintechllc.com',
    'https://www.abedintechllc.com',
    'https://lorilee-neediest-zina.ngrok-free.dev',
    'https://frances-vegetative-vincent.ngrok-free.dev'
]

# ─── Reverse-proxy awareness ──────────────────────────────────────────
# Production runs behind nginx / Cloudflare / ngrok which terminate TLS and
# forward to Django over HTTP. Without these settings, request.scheme would
# always be 'http', breaking absolute URLs in outgoing emails (e.g. payment
# approval links) — they'd come out http:// and browsers would block them.
#
# These are safe in dev too: when nothing is in front of Django, the headers
# below simply don't exist and request.scheme falls back to the real scheme.
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True

# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third party apps
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'drf_spectacular',

    # Our apps
    'admin_panel',
    'accounts',
    'platforms',
    'posts',
    'ai_caption',
    'ai_image',
    'ai_video',
    'upcoming_features',
    'messenger_bot',
    'api',
    'onboarding',
    'brands',
    'video_studio',  # AI Video Generation with Google Veo
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'socialsync.middleware.ImpersonationMiddleware',
    # Security middleware to detect cross-user data leakage
    'socialsync.security_middleware.UserDataIsolationMiddleware',
    'socialsync.security_middleware.ConcurrentUserCreationDetector',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'socialsync.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [
            os.path.join(BASE_DIR, 'templates'),
            os.path.join(BASE_DIR, 'frontend', 'dist'),  # React build for index.html
        ],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'socialsync.wsgi.application'


# Database
# https://docs.djangoproject.com/en/4.2/ref/settings/#databases

# ════════════════════════════════════════════════════════════════════════════
# ENVIRONMENT-BASED DATABASE CONFIGURATION
# ════════════════════════════════════════════════════════════════════════════
# Set DB_ENGINE in .env file:
#   - 'sqlite' (default) → Development, single-user testing
#   - 'postgresql' → Production, multi-user environments
#   - 'mysql' → Alternative production option
#
# IMPORTANT: SQLite is NOT safe for production with concurrent users!
# Use PostgreSQL or MySQL for production deployments.
# ════════════════════════════════════════════════════════════════════════════

DB_ENGINE = config('DB_ENGINE', default='sqlite').lower()

if DB_ENGINE == 'postgresql':
    # PostgreSQL Configuration (PRODUCTION RECOMMENDED)
    # Requires: pip install psycopg2-binary
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': config('DB_NAME', default='sellanto_db'),
            'USER': config('DB_USER', default='sellanto_user'),
            'PASSWORD': config('DB_PASSWORD', default=''),
            'HOST': config('DB_HOST', default='localhost'),
            'PORT': config('DB_PORT', default='5432'),
            'ATOMIC_REQUESTS': True,  # Wrap each view in a transaction
            'CONN_MAX_AGE': 600,  # Connection pooling (10 minutes)
            'OPTIONS': {
                'connect_timeout': 10,
                'options': '-c default_transaction_isolation=read committed',
            },
        }
    }

elif DB_ENGINE == 'mysql':
    # MySQL Configuration (PRODUCTION ALTERNATIVE)
    # Requires: pip install mysqlclient
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.mysql',
            'NAME': config('DB_NAME', default='sellanto_db'),
            'USER': config('DB_USER', default='sellanto_user'),
            'PASSWORD': config('DB_PASSWORD', default=''),
            'HOST': config('DB_HOST', default='localhost'),
            'PORT': config('DB_PORT', default='3306'),
            'ATOMIC_REQUESTS': True,
            'CONN_MAX_AGE': 600,
            'OPTIONS': {
                'init_command': "SET sql_mode='STRICT_TRANS_TABLES', innodb_lock_wait_timeout=10",
                'charset': 'utf8mb4',
                'isolation_level': 'read committed',
            },
        }
    }

else:
    # SQLite Configuration (DEVELOPMENT ONLY - DEFAULT)
    # ⚠️ WARNING: Not safe for production with concurrent users!
    # File-level locking only, no row-level locks, weak ACID guarantees
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
            'ATOMIC_REQUESTS': False,  # ❌ Disabled to prevent database locks in SQLite
            # Note: SQLite + ATOMIC_REQUESTS = write locks block all requests
            # Each view transaction holds a file-level lock, causing "database is locked" errors
            'OPTIONS': {
                'timeout': 20,  # Increase timeout from 5s default to 20s
                'init_command': 'PRAGMA journal_mode=WAL;',  # Enable Write-Ahead Logging for better concurrency
            },
        }
    }



# Password validation
# https://docs.djangoproject.com/en/4.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/4.2/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE='Asia/Dhaka'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/4.2/howto/static-files/
# Static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'
STATICFILES_DIRS = [
    os.path.join(BASE_DIR, 'static'),
    os.path.join(BASE_DIR, 'frontend', 'dist'),  # React build (includes assets folder)
]
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# Media files (User uploads)
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# React Frontend Build Directory
REACT_BUILD_DIR = os.path.join(BASE_DIR, 'frontend', 'dist')

# Default primary key field type
# https://docs.djangoproject.com/en/4.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ─── Email / SMTP ─────────────────────────────────────────────────────
# Used for payment request notifications and user confirmations.
EMAIL_BACKEND = config(
    'EMAIL_BACKEND',
    default='django.core.mail.backends.smtp.EmailBackend',
)
EMAIL_HOST = config('EMAIL_HOST', default='smtp.gmail.com')
EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
EMAIL_USE_TLS = config('EMAIL_USE_TLS', default=True, cast=bool)
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
DEFAULT_FROM_EMAIL = config(
    'DEFAULT_FROM_EMAIL',
    default=EMAIL_HOST_USER or 'noreply@sellanto.app',
)
# Where payment-request notifications are sent.
ADMIN_NOTIFICATION_EMAIL = config(
    'ADMIN_NOTIFICATION_EMAIL',
    default='',
)

# Public base URL — used to build absolute links inside outgoing emails
# (e.g. one-click payment-approval URLs). For local dev this points at
# the Django runserver; in production set SITE_URL=https://yourdomain.com.
SITE_URL = config('SITE_URL', default='http://127.0.0.1:8000')

# Django REST Framework settings
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'api.authentication.ImpersonatingJWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 10,
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

SPECTACULAR_SETTINGS = {
    'TITLE': 'SocialSync API',
    'DESCRIPTION': 'Complete API documentation for the SocialSync social media management platform.',
    'VERSION': '1.4.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'COMPONENT_SPLIT_REQUEST': True,
    'SCHEMA_PATH_PREFIX': '/api/v1/',
}

# JWT Settings
from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# CORS Settings
CORS_ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://abedintechllc.com',
    'https://www.abedintechllc.com',
    'https://lorilee-neediest-zina.ngrok-free.dev',
]

CORS_ALLOW_CREDENTIALS = True

app_version ='v1.2.3/new_features'

# ════════════════════════════════════════════════════════════════════════════
# CELERY CONFIGURATION (for async video generation)
# ════════════════════════════════════════════════════════════════════════════
CELERY_BROKER_URL = config('CELERY_BROKER_URL', default='redis://localhost:6379/0')
CELERY_RESULT_BACKEND = config('CELERY_RESULT_BACKEND', default='redis://localhost:6379/0')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60  # 30 minutes max per task

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '[{asctime}] {levelname} {name} | {message}',
            'style': '{',
        },
        'security': {
            'format': '[{asctime}] SECURITY {levelname} | {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        'file': {
            'class': 'logging.FileHandler',
            'filename': os.path.join(BASE_DIR, 'django.log'),
            'formatter': 'verbose',
        },
        'security_file': {
            'class': 'logging.FileHandler',
            'filename': os.path.join(BASE_DIR, 'security.log'),
            'formatter': 'security',
            'level': 'WARNING',  # Only log warnings and above for security
        },
    },
    'root': {
        'handlers': ['console', 'file'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': False,
        },
        'platforms': {
            'handlers': ['console', 'file'],
            'level': 'DEBUG',
            'propagate': False,
        },
        'posts': {
            'handlers': ['console', 'file'],
            'level': 'DEBUG',
            'propagate': False,
        },
        'accounts': {
            'handlers': ['console', 'file'],
            'level': 'DEBUG',
            'propagate': False,
        },
        'security': {
            'handlers': ['console', 'security_file'],
            'level': 'WARNING',
            'propagate': False,
        },
    },
}