# SocialSync-AI Security Issues & Technical Debt

## CRITICAL Security Issues (Fix Immediately)

### 1. Hardcoded ANTHROPIC_API_KEY
- **File**: `socialsync/settings.py` line ~13
- **Issue**: Real API key hardcoded as default value
- **Fix**: `ANTHROPIC_API_KEY = config('ANTHROPIC_API_KEY')` — no default, fail fast

### 2. Base64 API Key "Encryption" (Not Encryption)
- **Files**: `ai_caption/models.py` (UserAPISettings._openai_api_key), `ai_image/models.py` (UserImageSettings), `ai_video/models.py` (UserVideoSettings)
- **Issue**: `set_openai_api_key()` uses `base64.b64encode()` — trivially reversible
- **Fix**: Use `cryptography.fernet` with a proper secret key

### 3. Plaintext API Key in Voice
- **File**: `ai_voice/models.py` — `UserVoiceSettings.openai_api_key = CharField(max_length=255)`
- **Issue**: No encoding at all — stored as plain text in SQLite
- **Fix**: Migrate to encrypted field like others (even base64 is better here)

### 4. Hardcoded Fallback SECRET_KEY
- **File**: `socialsync/settings.py` line ~16
- **Issue**: `SECRET_KEY = config('DJANGO_SECRET_KEY', default='django-insecure-rf#m85xc...')`
- **Fix**: Remove default, raise ImproperlyConfigured if missing

### 5. Admin Impersonation Without Audit Log
- **File**: `socialsync/settings.py` middleware includes `ImpersonationMiddleware`
- **Issue**: Admin can impersonate any user via `X-Impersonate-User: <user_id>` header — no logging
- **Fix**: Add audit log model + log every impersonation event with timestamp

### 6. No Rate Limiting on AI Endpoints
- **File**: `api/views.py` — AI generation endpoints have no throttling
- **Risk**: Runaway API costs, DoS potential
- **Fix**: Add `@throttle_classes([UserRateThrottle])` on generation endpoints

### 7. Admin API Keys in UserProfile
- **File**: `accounts/models.py` — `UserProfile.admin_openai_key`, `admin_gemini_key` stored as TextField (base64)
- **Fix**: Same fernet encryption approach

---

## Technical Debt

### Monolithic API
- `api/views.py` is 3500+ LOC
- `api/serializers.py` is ~68KB
- Should be split by domain (posts, brands, ai_caption, etc.)

### Legacy/Dead Files
- `accounts/models_v1.py` — unused legacy
- `accounts/models_v2.py` — unused legacy
- Consider deleting after confirming no migrations reference them

### Missing Infrastructure
- **Redis/Caching**: Not implemented. Add `django-redis` + `@cache_page` for read-heavy endpoints
- **Celery**: Video generation is synchronous. Should be async queue (Celery + Redis)
- **APScheduler**: Present in requirements but usage unclear. Audit or remove.

### Zero Test Coverage
- All `tests.py` files are empty stubs
- Priority test areas: auth flow, RBAC permissions, AI generation limits, approval workflow

### Database
- SQLite used in dev (acceptable)
- MySQL config available but commented out in settings
- For production: enable MySQL config via env vars

### Missing Features
- No request/response audit logging
- No API key rotation mechanism
- No webhook signature verification for messenger bot payloads

---

## Key Dependencies (requirements.txt highlights)
```
Django==6.0.3
djangorestframework==3.16.1
openai==1.97.0
anthropic==0.84.0
sentence-transformers==5.0.0  # RAG embeddings
langchain==0.3.26             # LLM chaining
chromadb==1.0.15              # Vector store
moviepy==2.2.1                # Video processing
pillow==10.3.0                # Image processing
pdfplumber==0.11.7            # PDF extraction
pytesseract==0.3.13           # OCR
tweepy==4.16.0                # Twitter API
APScheduler==3.11.0           # Task scheduling (unclear usage)
gunicorn==23.0.0              # Production server
whitenoise==6.12.0            # Static file serving
```
