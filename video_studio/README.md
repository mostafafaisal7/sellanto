# 🎬 SaleAnto Video Studio

AI-powered video generation system using **Google Veo 3.1** for e-commerce product videos.

## Overview

Video Studio enables automated creation of professional product videos with:
- **8-second clip generation** using Google Veo 3.1 API
- **BrandDNA integration** for consistent brand styling
- **Image-to-video** from product photos
- **Clip merging** with professional transitions
- **Gemini prompt optimization** for better results
- **Multi-platform optimization** (Instagram, TikTok, YouTube, Amazon)

## Features

### ✅ Core Features
1. **AI Video Generation** - Generate 8-second clips from text prompts
2. **Image-to-Video** - Use product photos as start frames
3. **Brand Context** - Inject brand colors, voice, and style automatically
4. **Prompt Enhancement** - Gemini AI optimizes prompts for better Veo results
5. **Video Merging** - Combine clips with crossfade, wipe, or slide transitions
6. **Async Processing** - Celery task queue for non-blocking generation
7. **Template Library** - Pre-built video templates for common use cases
8. **A/B Testing** - Generate variants to test performance

### 🎯 Advanced Features
- Multi-angle product suites (360°, closeup, lifestyle, etc.)
- Platform-specific optimization
- Caption overlays and background music
- Logo watermarking
- Cost tracking and analytics
- Video quality scoring

## Quick Start

### 1. Install Dependencies

```bash
# Install Python packages
pip install -r video_studio_requirements.txt

# Install system dependencies
# Windows: Download FFmpeg, ImageMagick, Redis manually
# Linux:
sudo apt-get install ffmpeg imagemagick redis-server

# macOS:
brew install ffmpeg imagemagick redis
```

### 2. Run Migrations

```bash
python manage.py makemigrations video_studio
python manage.py migrate
```

### 3. Configure API Keys

Add to `.env` file:
```env
GEMINI_API_KEY=your_gemini_api_key_here
CELERY_BROKER_URL=redis://localhost:6379/0
```

### 4. Start Services

```bash
# Terminal 1: Start Redis
redis-server

# Terminal 2: Start Celery worker
celery -A socialsync worker --loglevel=info

# Terminal 3: Start Django
python manage.py runserver
```

### 5. Test API

```bash
python manage.py shell
```

```python
from video_studio.services.veo_service import VeoVideoService

service = VeoVideoService()
result = service.test_api_key()
print(result)  # Should return {'success': True, 'message': '...'}
```

## API Endpoints

### Projects
- `POST /video-studio/projects/create/` - Create project
- `GET /video-studio/projects/` - List projects
- `GET /video-studio/projects/<id>/` - Project details

### Clip Generation
- `POST /video-studio/clips/generate/` - Generate single clip
- `POST /video-studio/clips/batch-generate/` - Batch generate clips
- `GET /video-studio/clips/<id>/status/` - Check clip status

### Clip Management
- `POST /video-studio/clips/select/` - Select clips for merging
- `POST /video-studio/clips/reorder/` - Reorder clips

### Video Merging
- `POST /video-studio/merge/` - Merge selected clips
- `GET /video-studio/merge/<id>/status/` - Check merge status

### Download
- `GET /video-studio/clips/<id>/download/` - Download clip
- `GET /video-studio/merge/<id>/download/` - Download merged video

## Usage Examples

### Generate Single Clip

```python
import requests

response = requests.post('http://localhost:8000/video-studio/clips/generate/', json={
    'project_id': 1,
    'prompt': 'Smooth 360° rotation of premium wireless headphones',
    'duration': 8,
    'aspect_ratio': '16:9',
    'resolution': '1080p',
    'optimize_prompt': True
})

result = response.json()
print(f"Clip ID: {result['clip_id']}")
```

### Use Template

```python
response = requests.post('http://localhost:8000/video-studio/clips/batch-generate/', json={
    'project_id': 1,
    'template_id': 1  # Product Launch template
})

result = response.json()
print(f"Generating {result['clips_count']} clips")
```

### Merge Clips

```python
# Select clips first
requests.post('http://localhost:8000/video-studio/clips/select/', json={
    'clip_ids': [1, 2, 3, 4],
    'selected': True
})

# Merge selected clips
response = requests.post('http://localhost:8000/video-studio/merge/', json={
    'project_id': 1,
    'transition_type': 'crossfade',
    'transition_duration': 0.5,
    'add_captions': True,
    'captions_data': [
        {
            'text': 'New Product Launch',
            'start': 0,
            'duration': 3,
            'position': 'bottom',
            'fontsize': 60,
            'color': 'white'
        }
    ]
})

print(f"Merged Video ID: {response.json()['merged_video_id']}")
```

## Database Models

### VideoProject
Main container for video generation project.
```python
project = VideoProject.objects.create(
    user=user,
    brand=brand,
    name="Summer Collection 2026",
    product_name="Wireless Headphones XPro",
    target_platforms=['instagram', 'tiktok']
)
```

### VideoClip
Individual 8-second video clip.
```python
clip = VideoClip.objects.create(
    project=project,
    prompt="360° product rotation",
    duration=8,
    aspect_ratio='16:9',
    resolution='1080p'
)
```

### MergedVideo
Final merged video from multiple clips.
```python
merged = MergedVideo.objects.create(
    project=project,
    clip_ids=[1, 2, 3],
    transition_type='crossfade'
)
```

## Services

### VeoVideoService
Handles Veo API calls for video generation.

```python
from video_studio.services.veo_service import VeoVideoService

service = VeoVideoService(api_key='your_key')
result = service.generate_video(
    prompt="Product showcase with dramatic lighting",
    reference_image=open('product.jpg', 'rb').read(),
    duration=8,
    aspect_ratio='16:9',
    model_tier='standard'
)
```

### BrandDNAPromptBuilder
Injects brand context into prompts.

```python
from video_studio.services.prompt_builder import BrandDNAPromptBuilder

builder = BrandDNAPromptBuilder()
enhanced = builder.build_enhanced_prompt(
    user_prompt="Show product rotating",
    brand=brand,
    product_image='product.jpg'
)
```

### GeminiPromptOptimizer
Optimizes prompts using Gemini AI.

```python
from video_studio.services.optimizer import GeminiPromptOptimizer

optimizer = GeminiPromptOptimizer(api_key='your_key')
optimized = optimizer.optimize_prompt_for_veo(
    user_prompt="Product rotation",
    brand=brand,
    platform='instagram'
)
```

### VideoMergeService
Merges clips with transitions.

```python
from video_studio.services.merge_service import VideoMergeService

merger = VideoMergeService()
output = merger.merge_clips(
    clip_paths=['clip1.mp4', 'clip2.mp4', 'clip3.mp4'],
    transition_type='crossfade',
    transition_duration=0.5
)
```

## Cost Management

### Pricing (April 2026)
- **Fast**: $0.15/second = $1.20 per 8s clip
- **Standard**: $0.25/second = $2.00 per 8s clip
- **Premium**: $0.40/second = $3.20 per 8s clip

### Cost Optimization Tips
1. Use **Fast** model for testing
2. Use **Standard** for production
3. Use **Premium** only for high-value campaigns
4. Cache results with seed parameter
5. Batch process to reduce overhead

## Troubleshooting

### MoviePy Errors
```bash
# ImageMagick not found
# Windows: Add ImageMagick to PATH
# Linux: sudo apt-get install imagemagick
# macOS: brew install imagemagick
```

### Celery Errors
```bash
# Redis connection refused
redis-server  # Start Redis first

# On Windows
# Download Redis from https://github.com/microsoftarchive/redis/releases
# Run redis-server.exe
```

### Veo API Errors
```python
# Test API key
from video_studio.services.veo_service import VeoVideoService
service = VeoVideoService()
print(service.test_api_key())

# Common issues:
# - API key not set: Add GEMINI_API_KEY to .env
# - Model not available: Try different tier or region
# - Rate limiting: Reduce concurrent requests
```

## Performance Tips

1. **Use lower resolution for testing** (720p instead of 1080p)
2. **Disable audio during testing** (saves bandwidth)
3. **Use Celery** for async processing
4. **Monitor Redis memory** usage
5. **Clean up temp files** regularly
6. **Batch process** multiple clips
7. **Use seeds** for reproducibility
8. **Enable caching** for identical prompts

## Platform Optimization

### Instagram Feed (1:1 or 4:5)
```python
clip = VideoClip.objects.create(
    aspect_ratio='1:1',
    resolution='1080p',
    duration=10  # 8-15s optimal
)
```

### Instagram Story/TikTok (9:16)
```python
clip = VideoClip.objects.create(
    aspect_ratio='9:16',
    resolution='1080p',
    duration=8  # 5-8s optimal
)
```

### YouTube/Website (16:9)
```python
clip = VideoClip.objects.create(
    aspect_ratio='16:9',
    resolution='1080p',
    duration=20  # 15-30s optimal
)
```

## Templates

Pre-built templates for common scenarios:

### Product Launch
```python
template = VideoTemplate.objects.create(
    name="Product Launch",
    category='product_launch',
    clips_config=[
        {'type': 'hero_reveal', 'duration': 8, 'prompt': 'Dramatic reveal...'},
        {'type': '360_rotation', 'duration': 8, 'prompt': 'Full rotation...'},
        {'type': 'features', 'duration': 8, 'prompt': 'Feature highlights...'}
    ]
)
```

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## License

Copyright © 2026 SaleAnto. All rights reserved.

## Support

- Documentation: https://docs.sellanto.com/video-studio
- Issues: https://github.com/sellanto/sellanto/issues
- Email: support@sellanto.com

---

**Built with ❤️ by SaleAnto Team**
