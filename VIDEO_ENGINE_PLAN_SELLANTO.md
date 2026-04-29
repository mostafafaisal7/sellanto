# 🎬 SaleAnto Video Engine - Complete Implementation Guide
## Google Veo 3.1 AI Video Generation System

**Version:** 1.0
**Last Updated:** April 30, 2026
**Target Platform:** Django + React
**AI Model:** Google Veo 3.1 via Gemini API

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Google Veo API Deep Dive](#google-veo-api-deep-dive)
3. [Core Features (Your Requirements)](#core-features)
4. [Advanced Features (Recommended)](#advanced-features)
5. [Technical Architecture](#technical-architecture)
6. [Database Schema](#database-schema)
7. [API Integration Guide](#api-integration-guide)
8. [BrandDNA Integration](#branddna-integration)
9. [Video Merging System](#video-merging-system)
10. [E-commerce Optimization](#e-commerce-optimization)
11. [Implementation Roadmap](#implementation-roadmap)
12. [Cost Analysis](#cost-analysis)
13. [Best Practices](#best-practices)
14. [Future Enhancements](#future-enhancements)

---

## 1. Executive Summary

### 🎯 Vision
SaleAnto Video Engine একটি AI-powered video generation platform যা Google Veo 3.1 ব্যবহার করে e-commerce product videos তৈরি করবে। এটা তোমার existing workspace, brand DNA, এবং product context ব্যবহার করে professional-quality marketing videos generate করবে।

### 🚀 Key Differentiators
- **Context-Aware**: BrandDNA + Workspace + Product data integration
- **Modular**: 8-second clips যা merge করা যায়
- **Image-to-Video**: Product photos থেকে video generation
- **Platform-Optimized**: Different aspect ratios for social media
- **Audio-Enabled**: Native audio generation with Veo 3.1
- **Cost-Effective**: $0.15-$0.40 per second (vs competitors $5-10 per video)

### 📊 Target Use Cases
1. Product showcase videos (360° rotation, close-ups)
2. Lifestyle/usage videos (product in action)
3. Social media ads (Instagram Stories, TikTok, YouTube Shorts)
4. E-commerce product pages (autoplay demos)
5. Email marketing videos
6. A/B testing content variations

---

## 2. Google Veo API Deep Dive

### 🔍 What is Veo 3.1?

**Veo 3.1** হলো Google এর state-of-the-art AI video generation model যা Gemini API এর মাধ্যমে available।

#### Key Specifications:
- **Resolution**: 720p, 1080p, 4K
- **Duration**: 8 seconds (extendable by chaining)
- **Aspect Ratios**: 16:9 (landscape), 9:16 (portrait), 1:1 (square)
- **FPS**: 24-30 fps
- **Audio**: Native audio generation (conversations, sound effects)
- **Quality**: Cinematic, photorealistic

### 📡 API Models Available

| Model | Speed | Quality | Cost/sec | Best For |
|-------|-------|---------|----------|----------|
| **veo-3.1-generate-preview** | Slow | Highest | $0.40 | Professional campaigns |
| **veo-3.1-lite-generate-preview** | Medium | High | $0.25 | Standard content |
| **veo-3.1-fast** | Fast | Good | $0.15 | Bulk generation, testing |

### 🎨 Core Features

#### 1. **Text-to-Video**
```python
# Basic text-to-video generation
prompt = "A sleek wireless headphone rotating 360 degrees on a minimalist white background"
```

#### 2. **Image-to-Video** (Veo 3.x only)
```python
# Product image → animated video
reference_image = open('product.jpg', 'rb').read()
prompt = "Smooth camera orbit around the product with soft studio lighting"
```

#### 3. **Frame Control** (Start + End frames)
```python
# Define exact start and end composition
start_frame = "product_front.jpg"
end_frame = "product_back.jpg"
# Veo generates smooth transition between frames
```

#### 4. **Video Extension** (Scene Continuation)
```python
# Extend existing 8s video by another 8s
previous_video = "clip_001.mp4"
continuation_prompt = "Camera zooms in to show product details"
```

#### 5. **Reference Images** (Character/Product Consistency)
```python
# Use up to 3 reference images for consistency
reference_images = [
    "product_angle1.jpg",
    "product_angle2.jpg",
    "product_angle3.jpg"
]
# Maintains product appearance across different prompts
```

### 🎬 Advanced Camera Controls

Veo 3.1 তে তুমি detailed camera instructions দিতে পারো:

#### Camera Movements:
- **Dolly**: `"dolly shot pushing in toward the product"`
- **Crane**: `"crane shot starting low and rising upward"`
- **Pan**: `"camera panning left to right"`
- **Tilt**: `"camera tilting up from product base to top"`
- **Orbit**: `"camera orbiting 360 degrees around subject"`
- **Tracking**: `"tracking shot following the product movement"`
- **Handheld**: `"handheld camera with subtle shakiness for realism"`

#### Camera Angles:
- **Aerial/Top-down**: `"bird's eye view looking down"`
- **Eye-level**: `"straight-on eye-level shot"`
- **Low angle**: `"worm's eye view looking up"`
- **Close-up**: `"extreme close-up showing texture details"`
- **Wide shot**: `"wide establishing shot showing full scene"`

#### Cinematography Terms:
- **Depth of Field**: `"shallow depth of field, blurred background"`
- **Lighting**: `"golden hour lighting, warm tones"` or `"studio softbox lighting"`
- **Composition**: `"rule of thirds composition"`, `"centered framing"`

### 🎵 Audio Generation

Veo 3.1 automatically generates:
- **Natural Sounds**: Product movements, ambiance
- **Music**: Background scores (optional)
- **Voice**: Narration (if prompted)
- **SFX**: Sound effects synchronized with visuals

**Control Audio:**
```python
# In prompt
prompt = "Product reveal with uplifting background music and whoosh sound effect"

# Or disable audio
parameters = {
    "generateAudio": False  # Video only
}
```

### 📐 Technical Parameters

```python
# Full parameter set
payload = {
    "instances": [{
        "prompt": "Your detailed prompt here",
        "image": {  # Optional: for image-to-video
            "inlineData": {
                "data": base64_encoded_image,
                "mimeType": "image/jpeg"
            }
        }
    }],
    "parameters": {
        "aspectRatio": "16:9",  # or "9:16", "1:1"
        "resolution": "1080p",  # or "720p", "4k"
        "personGeneration": "allow_adult",
        "sampleCount": 1,
        "generateAudio": True,
        # Advanced (not all documented)
        "fps": 30,
        "seed": 12345,  # For reproducibility
    }
}
```

### 🔄 API Workflow

```python
# Step 1: Submit generation request
response = requests.post(
    f"https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning",
    headers={"x-goog-api-key": API_KEY},
    json=payload
)

# Step 2: Get operation name
operation_name = response.json()['name']

# Step 3: Poll for completion (async)
while True:
    status = requests.get(
        f"https://generativelanguage.googleapis.com/v1beta/{operation_name}",
        headers={"x-goog-api-key": API_KEY}
    )

    if status.json().get('done'):
        break

    time.sleep(10)  # Wait 10 seconds

# Step 4: Download video
video_uri = status.json()['response']['generateVideoResponse']['generatedSamples'][0]['video']['uri']
video_data = requests.get(video_uri, headers={"x-goog-api-key": API_KEY}).content
```

### ⚠️ API Limitations

| Limitation | Value | Workaround |
|------------|-------|------------|
| Max duration | 8 seconds | Chain multiple clips |
| Max concurrent requests | 10 | Queue system |
| Generation time | 2-10 minutes | Async processing |
| File size | ~50MB per 8s | Compression |
| Reference images | 3 max | Choose best angles |
| Regional availability | Limited | VPN/proxy (ToS check) |

### 💰 Pricing (as of April 2026)

- **Veo 3.1 with audio**: $0.40/second = **$3.20 per 8s clip**
- **Veo 3.1 Fast with audio**: $0.15/second = **$1.20 per 8s clip**
- **Image-to-video**: Same pricing
- **Video extension**: Same pricing

**Example Cost:**
- 4 clips (32 seconds total) = $12.80 (Veo 3.1) or $4.80 (Fast)
- 10 clips/day for 30 days = $3,840/month (Veo 3.1) or $1,440/month (Fast)

---

## 3. Core Features (Your Requirements)

### ✅ Feature 1: 8-Second Clip Generation

**Goal**: Generate multiple 8-second product video clips

**Implementation:**
```python
class VideoClipGenerator:
    def generate_clip(self, prompt, product_image, brand, workspace):
        """
        Generate single 8-second clip
        """
        # 1. Enhance prompt with BrandDNA
        enhanced_prompt = self.build_prompt(
            user_prompt=prompt,
            brand=brand,
            product_image=product_image,
            workspace=workspace
        )

        # 2. Prepare image for Veo
        image_data = self.preprocess_image(product_image)

        # 3. Call Veo API
        result = self.veo_service.generate_video(
            prompt=enhanced_prompt,
            reference_image=image_data,
            duration=8,
            aspect_ratio='16:9',
            resolution='1080p'
        )

        # 4. Save clip
        clip = VideoClip.objects.create(
            prompt=prompt,
            enhanced_prompt=enhanced_prompt,
            video_file=ContentFile(result['video_data']),
            thumbnail=self.extract_thumbnail(result['video_data']),
            duration=8,
            veo_model_used=result['model_used']
        )

        return clip
```

**User Flow:**
1. User uploads product image
2. User enters 4-8 different prompts (e.g., "360° rotation", "close-up", "lifestyle shot")
3. System generates 8s clip for each prompt
4. User sees thumbnail grid of all clips

---

### ✅ Feature 2: Clip Selection & Merge

**Goal**: Select clips and merge into final video

**Implementation:**
```python
class VideoMergeService:
    def merge_clips(self, clip_ids, transition_type='crossfade', transition_duration=0.5):
        """
        Merge selected clips with transitions
        """
        from moviepy.editor import VideoFileClip, concatenate_videoclips, CompositeVideoClip

        # Load clips in order
        video_clips = []
        for clip_id in clip_ids:
            clip = VideoClip.objects.get(id=clip_id)
            video = VideoFileClip(clip.video_file.path)
            video_clips.append(video)

        # Apply transitions
        if transition_type == 'crossfade':
            # Crossfade transition
            final = concatenate_videoclips(
                video_clips,
                method='compose',
                transition=self._create_crossfade(transition_duration)
            )
        elif transition_type == 'cut':
            # Hard cut (no transition)
            final = concatenate_videoclips(video_clips)
        elif transition_type == 'wipe':
            # Wipe transition (left to right)
            final = self._wipe_transition(video_clips, transition_duration)

        # Export merged video
        output_path = f'/tmp/merged_{uuid4().hex}.mp4'
        final.write_videofile(
            output_path,
            codec='libx264',
            audio_codec='aac',
            fps=30,
            preset='medium',
            bitrate='5000k'
        )

        return output_path

    def _create_crossfade(self, duration):
        """Create crossfade transition effect"""
        def transition(clip1, clip2):
            return CompositeVideoClip([
                clip1.crossfadeout(duration),
                clip2.set_start(clip1.duration - duration).crossfadein(duration)
            ])
        return transition
```

**User Flow:**
1. User sees all generated clips in grid
2. User selects which clips to include (checkbox)
3. User drags to reorder clips
4. User chooses transition type (crossfade, cut, wipe)
5. System merges and shows preview
6. User downloads final video

---

### ✅ Feature 3: Workspace & BrandDNA Integration

**Goal**: Use brand context for consistent video generation

**Implementation:**
```python
class VeoPromptBuilder:
    def build_prompt(self, user_prompt, brand, product_image, workspace):
        """
        Inject BrandDNA into Veo prompt
        """
        # Extract BrandDNA
        brand_dna = brand.brand_dna

        # Analyze product image
        product_analysis = self.analyze_product_image(product_image)

        # Build structured prompt
        enhanced_prompt = f"""
{user_prompt}

BRAND CONTEXT:
- Brand: {brand.brand_name}
- Industry: {brand.industry}
- Target Audience: {', '.join(brand.audiences)}
- Brand Voice: {brand.voice_tone}
- Primary Colors: {self._extract_colors(brand_dna)}

PRODUCT DETAILS:
- Dominant Colors: {product_analysis['dominant_colors']}
- Product Type: {product_analysis['category']}
- Lighting Style: {product_analysis['lighting']}

VISUAL REQUIREMENTS:
- Maintain brand color palette throughout
- Use {brand.voice_tone} visual style
- Lighting should match product image ({product_analysis['lighting']})
- Background should complement product colors

TECHNICAL SPECS:
- Resolution: 1080p
- Duration: 8 seconds
- Style: Cinematic, professional e-commerce
- Camera: Smooth, deliberate movements
- Audio: Subtle ambient sound, no music
"""

        return enhanced_prompt

    def analyze_product_image(self, image_path):
        """
        Analyze product image for style matching
        """
        from PIL import Image
        import colorsys

        img = Image.open(image_path)

        # Extract dominant colors
        colors = img.getcolors(img.size[0] * img.size[1])
        dominant_colors = self._get_dominant_colors(colors, top_n=3)

        # Detect lighting type
        brightness = self._calculate_brightness(img)
        if brightness > 200:
            lighting = "bright, high-key"
        elif brightness < 100:
            lighting = "dark, low-key"
        else:
            lighting = "balanced, natural"

        # Detect background type
        bg_type = self._detect_background(img)

        return {
            'dominant_colors': dominant_colors,
            'lighting': lighting,
            'background': bg_type,
            'brightness': brightness,
            'category': 'product'  # Can use image classification
        }
```

**BrandDNA Fields Used:**
- `brand_name` → Watermark, context
- `industry` → Visual style (tech = modern, fashion = elegant)
- `voice_tone` → Video mood (professional = stable, playful = dynamic)
- `brand_dna['colors']` → Color grading, backgrounds
- `brand_dna['visual_style']` → Camera movements, aesthetics

---

### ✅ Feature 4: Start Frame (Product Image) Integration

**Goal**: Use product photo as first frame for video

**Implementation:**
```python
class ProductImageProcessor:
    def preprocess_for_veo(self, product_image_path):
        """
        Prepare product image for Veo image-to-video
        """
        from PIL import Image, ImageEnhance, ImageFilter
        from rembg import remove

        img = Image.open(product_image_path)

        # Step 1: Remove background (optional)
        if self._has_background(img):
            img = remove(img)  # rembg library

        # Step 2: Center product on canvas
        img = self._center_on_canvas(img, canvas_size=(1920, 1080))

        # Step 3: Enhance quality
        enhancer = ImageEnhance.Sharpness(img)
        img = enhancer.enhance(1.2)

        # Step 4: Add subtle lighting
        img = self._add_studio_lighting(img)

        # Step 5: Save optimized
        output = io.BytesIO()
        img.save(output, format='JPEG', quality=95)

        return output.getvalue()

    def _center_on_canvas(self, img, canvas_size):
        """Center product on larger canvas"""
        canvas = Image.new('RGBA', canvas_size, (255, 255, 255, 0))

        # Calculate centered position
        x = (canvas_size[0] - img.width) // 2
        y = (canvas_size[1] - img.height) // 2

        canvas.paste(img, (x, y), img)
        return canvas

    def _add_studio_lighting(self, img):
        """Add subtle gradient lighting"""
        from PIL import ImageDraw

        overlay = Image.new('RGBA', img.size, (255, 255, 255, 0))
        draw = ImageDraw.Draw(overlay)

        # Create radial gradient
        for i in range(255):
            alpha = int(i * 0.3)
            color = (255, 255, 255, alpha)
            # Draw ellipse gradient

        return Image.alpha_composite(img.convert('RGBA'), overlay)
```

**Workflow:**
1. User uploads product image → Background removed → Centered
2. Image sent to Veo as `reference_image` parameter
3. Veo generates video starting from this exact frame
4. Product remains consistent throughout 8s clip

---

### ✅ Feature 5: Fine-Tuning with Gemini

**Goal**: Use Gemini to optimize Veo prompts (like KlingAI)

**Implementation:**
```python
class GeminiPromptOptimizer:
    def optimize_prompt_for_veo(self, user_prompt, brand, product_category):
        """
        Use Gemini to refine user prompt for better Veo results
        """
        import google.generativeai as genai

        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-2.5-pro')

        optimization_prompt = f"""
You are an expert prompt engineer for AI video generation (Google Veo).

USER INPUT:
- Original Prompt: "{user_prompt}"
- Brand: {brand.brand_name} ({brand.industry})
- Product Category: {product_category}
- Brand Voice: {brand.voice_tone}

TASK:
Rewrite this prompt to maximize Veo 3.1's capabilities:

1. Add specific camera movements (dolly, crane, orbit, etc.)
2. Include lighting details (golden hour, studio softbox, etc.)
3. Specify composition (rule of thirds, centered, etc.)
4. Add motion details (speed, smoothness)
5. Include audio cues (ambient sound, music style)
6. Maintain brand voice and industry standards

OUTPUT FORMAT:
Return ONLY the optimized prompt (no explanations).
Keep it under 500 characters.
Make it cinematically detailed but natural.

EXAMPLE:
Input: "Show headphones rotating"
Output: "Cinematic dolly shot orbiting 360° around premium wireless headphones on minimalist white surface. Slow, smooth camera movement. Studio softbox lighting with soft shadows. Product centered, rule of thirds composition. Subtle ambient whoosh sound. Modern, sleek aesthetic. 8 seconds."

Now optimize the user's prompt:
"""

        response = model.generate_content(optimization_prompt)
        optimized = response.text.strip()

        # Log for learning
        PromptOptimizationLog.objects.create(
            original_prompt=user_prompt,
            optimized_prompt=optimized,
            brand=brand,
            model='gemini-2.5-pro'
        )

        return optimized
```

**Benefits:**
- Better video quality through optimized prompts
- Learn from successful prompts (build template library)
- Consistent style across brand videos
- Reduce trial-and-error

---

## 4. Advanced Features (Recommended)

### 🎯 Feature 6: Multi-Angle Product Suite

**Goal**: Generate complete product video suite from single image

```python
PRODUCT_ANGLES = {
    'hero_shot': {
        'prompt': 'Cinematic reveal of {product} with dramatic lighting, slow dolly push-in',
        'duration': 8,
        'style': 'dramatic'
    },
    '360_rotation': {
        'prompt': 'Smooth 360° orbit around {product} on clean background',
        'duration': 8,
        'style': 'showcase'
    },
    'detail_closeup': {
        'prompt': 'Extreme close-up macro shot of {product} texture and details',
        'duration': 8,
        'style': 'detailed'
    },
    'lifestyle_usage': {
        'prompt': 'Person using {product} in natural setting, handheld camera',
        'duration': 8,
        'style': 'authentic'
    },
    'features_highlight': {
        'prompt': 'Pan across {product} features with subtle zoom, professional',
        'duration': 8,
        'style': 'informative'
    }
}

def generate_product_suite(product_image, product_name):
    clips = []
    for angle_name, config in PRODUCT_ANGLES.items():
        prompt = config['prompt'].format(product=product_name)
        clip = generate_clip(prompt, product_image, config)
        clips.append(clip)
    return clips
```

---

### 🎯 Feature 7: A/B Testing Variants

**Goal**: Generate multiple versions for testing

```python
class ABTestingGenerator:
    def generate_variants(self, base_prompt, brand, variations=3):
        """
        Generate A/B test variants with different styles
        """
        variants = []

        styles = [
            {'mood': 'energetic', 'camera': 'dynamic', 'lighting': 'vibrant'},
            {'mood': 'elegant', 'camera': 'smooth', 'lighting': 'soft'},
            {'mood': 'playful', 'camera': 'bouncy', 'lighting': 'bright'}
        ]

        for i, style in enumerate(styles[:variations]):
            variant_prompt = f"""
{base_prompt}

Variant {i+1} Style:
- Mood: {style['mood']}
- Camera Movement: {style['camera']}
- Lighting: {style['lighting']}
"""

            clip = self.generate_clip(variant_prompt, brand)
            variants.append({
                'clip': clip,
                'variant_id': f'variant_{i+1}',
                'style': style
            })

        return variants
```

---

### 🎯 Feature 8: Platform-Specific Optimization

**Goal**: Auto-generate videos for different platforms

```python
PLATFORM_SPECS = {
    'instagram_feed': {
        'aspect_ratio': '1:1',
        'duration': 8,
        'resolution': '1080p',
        'style': 'vibrant, eye-catching'
    },
    'instagram_story': {
        'aspect_ratio': '9:16',
        'duration': 8,
        'resolution': '1080p',
        'style': 'vertical, immersive'
    },
    'tiktok': {
        'aspect_ratio': '9:16',
        'duration': 8,
        'resolution': '1080p',
        'style': 'fast-paced, trendy'
    },
    'youtube_shorts': {
        'aspect_ratio': '9:16',
        'duration': 8,
        'resolution': '1080p',
        'style': 'engaging, hook-first'
    },
    'facebook_feed': {
        'aspect_ratio': '16:9',
        'duration': 8,
        'resolution': '1080p',
        'style': 'informative, professional'
    }
}

def generate_for_platform(product_image, prompt, platform):
    specs = PLATFORM_SPECS[platform]

    enhanced_prompt = f"""
{prompt}

Platform: {platform.replace('_', ' ').title()}
Style: {specs['style']}
Optimized for {platform} audience and algorithm
"""

    return veo_service.generate_video(
        prompt=enhanced_prompt,
        reference_image=product_image,
        aspect_ratio=specs['aspect_ratio'],
        resolution=specs['resolution'],
        duration=specs['duration']
    )
```

---

### 🎯 Feature 9: Batch Generation Queue

**Goal**: Generate multiple videos asynchronously

```python
# Celery task
@shared_task
def batch_generate_videos(project_id):
    project = VideoProject.objects.get(id=project_id)
    prompts = project.prompts  # JSON field

    for i, prompt in enumerate(prompts):
        # Generate each clip
        clip = generate_video_clip.delay(
            project_id=project_id,
            prompt=prompt,
            index=i
        )

        # Update progress
        project.progress = (i + 1) / len(prompts) * 100
        project.save()

    # Auto-merge when all complete
    if project.auto_merge:
        merge_all_clips.delay(project_id)

@shared_task
def generate_video_clip(project_id, prompt, index):
    project = VideoProject.objects.get(id=project_id)

    # Generate clip
    result = veo_service.generate_video(...)

    # Save
    VideoClip.objects.create(
        project=project,
        prompt=prompt,
        order_index=index,
        video_file=result['video_data']
    )
```

---

### 🎯 Feature 10: Smart Caption Overlay

**Goal**: Add text overlays to videos

```python
class CaptionOverlayService:
    def add_captions(self, video_path, captions, style='modern'):
        """
        Add text captions to video using moviepy
        """
        from moviepy.editor import VideoFileClip, TextClip, CompositeVideoClip

        video = VideoFileClip(video_path)

        # Create text clips
        text_clips = []
        for caption in captions:
            txt_clip = TextClip(
                caption['text'],
                fontsize=caption.get('fontsize', 50),
                color=caption.get('color', 'white'),
                font=caption.get('font', 'Arial-Bold'),
                stroke_color=caption.get('stroke_color', 'black'),
                stroke_width=caption.get('stroke_width', 2)
            ).set_position(caption.get('position', 'bottom'))\
             .set_start(caption['start'])\
             .set_duration(caption['duration'])

            text_clips.append(txt_clip)

        # Composite
        final = CompositeVideoClip([video] + text_clips)

        return final
```

---

### 🎯 Feature 11: Video Analytics Integration

**Goal**: Track video performance

```python
class VideoAnalytics:
    def track_video_performance(self, video_clip):
        """
        Track how videos perform on social platforms
        """
        return {
            'views': self.get_platform_views(video_clip),
            'engagement_rate': self.calculate_engagement(video_clip),
            'watch_time': self.get_average_watch_time(video_clip),
            'drop_off_point': self.analyze_drop_off(video_clip),
            'best_performing_style': self.identify_best_style(video_clip)
        }

    def generate_insights(self, project):
        """
        ML-based insights from past videos
        """
        insights = {
            'best_angles': [],  # Which angles perform best
            'optimal_duration': 8,  # Optimal clip length
            'effective_transitions': [],  # Best transition types
            'color_preferences': [],  # Audience color preferences
        }

        # Use past data to inform future generations
        return insights
```

---

### 🎯 Feature 12: Template Library

**Goal**: Pre-built video templates

```python
VIDEO_TEMPLATES = {
    'product_launch': {
        'clips': [
            {'type': 'hero_reveal', 'duration': 8, 'prompt': 'Dramatic reveal...'},
            {'type': '360_spin', 'duration': 8, 'prompt': 'Full rotation...'},
            {'type': 'features', 'duration': 8, 'prompt': 'Feature highlights...'},
            {'type': 'cta', 'duration': 8, 'prompt': 'Call to action...'}
        ],
        'transitions': 'crossfade',
        'music': 'upbeat',
        'total_duration': 32
    },

    'social_media_ad': {
        'clips': [
            {'type': 'hook', 'duration': 3, 'prompt': 'Attention-grabbing...'},
            {'type': 'product', 'duration': 5, 'prompt': 'Product showcase...'},
        ],
        'transitions': 'fast_cut',
        'captions': True,
        'total_duration': 8
    },

    'unboxing_experience': {
        'clips': [
            {'type': 'box_reveal', 'duration': 8},
            {'type': 'product_reveal', 'duration': 8},
            {'type': 'first_look', 'duration': 8}
        ],
        'transitions': 'smooth_wipe',
        'total_duration': 24
    }
}

def apply_template(template_name, product_image, brand):
    template = VIDEO_TEMPLATES[template_name]

    clips = []
    for clip_config in template['clips']:
        prompt = clip_config['prompt'].format(
            product=brand.product_name,
            brand=brand.brand_name
        )
        clip = generate_clip(prompt, product_image, clip_config)
        clips.append(clip)

    # Merge with template settings
    final_video = merge_clips(
        clips,
        transition=template['transitions'],
        music=template.get('music')
    )

    return final_video
```

---

## 5. Technical Architecture

### 🏗️ System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                        │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │ Project     │  │ Clip         │  │ Merge           │   │
│  │ Setup       │→ │ Generator    │→ │ Editor          │   │
│  └─────────────┘  └──────────────┘  └─────────────────┘   │
└────────────────────────────┬────────────────────────────────┘
                             │ WebSocket / REST API
┌────────────────────────────┴────────────────────────────────┐
│                   Django Backend                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              video_studio App                        │  │
│  │  ┌────────────┐  ┌─────────────┐  ┌──────────────┐ │  │
│  │  │ Views      │  │ Services    │  │ Models       │ │  │
│  │  │ (API)      │→ │             │→ │              │ │  │
│  │  └────────────┘  └─────────────┘  └──────────────┘ │  │
│  └──────────────────────────────────────────────────────┘  │
│                             │                               │
│  ┌─────────────────────────┴──────────────────────────┐   │
│  │           Background Tasks (Celery)                 │   │
│  │  • Video generation (async)                         │   │
│  │  • Video merging                                    │   │
│  │  • Prompt optimization                              │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼────────┐  ┌───────▼────────┐  ┌───────▼────────┐
│ Google Veo API │  │ Gemini API     │  │ External       │
│ (Video Gen)    │  │ (Optimization) │  │ Services       │
└────────────────┘  └────────────────┘  └────────────────┘
        │                    │                    │
        └────────────────────┴────────────────────┘
                             │
                    ┌────────▼─────────┐
                    │ Media Storage    │
                    │ (AWS S3 / Local) │
                    └──────────────────┘
```

---

### 📦 Database Models

```python
# video_studio/models.py

class VideoProject(models.Model):
    """Main project container"""
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE)
    brand = models.ForeignKey(Brand, on_delete=models.SET_NULL, null=True)

    # Project details
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)

    # Product context
    product_images = models.JSONField(default=list)  # List of image paths
    product_name = models.CharField(max_length=200)
    product_description = models.TextField()
    product_category = models.CharField(max_length=100)

    # Generation settings
    target_platforms = models.JSONField(default=list)  # ['instagram', 'tiktok']
    default_aspect_ratio = models.CharField(max_length=10, default='16:9')
    default_resolution = models.CharField(max_length=10, default='1080p')
    auto_merge = models.BooleanField(default=False)

    # Status tracking
    status = models.CharField(max_length=20, choices=[
        ('draft', 'Draft'),
        ('generating', 'Generating Clips'),
        ('ready', 'Ready for Merge'),
        ('merging', 'Merging'),
        ('completed', 'Completed'),
        ('failed', 'Failed')
    ], default='draft')

    progress = models.IntegerField(default=0)  # 0-100
    total_clips = models.IntegerField(default=0)
    completed_clips = models.IntegerField(default=0)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'video_studio_projects'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} - {self.user.username}"


class VideoClip(models.Model):
    """Individual 8-second video clip"""
    project = models.ForeignKey(VideoProject, on_delete=models.CASCADE, related_name='clips')

    # Input
    prompt = models.TextField()
    enhanced_prompt = models.TextField()  # After BrandDNA injection
    optimized_prompt = models.TextField(blank=True)  # After Gemini optimization
    start_frame = models.ImageField(upload_to='video_clips/frames/', blank=True, null=True)

    # Generation settings
    duration = models.IntegerField(default=8)
    aspect_ratio = models.CharField(max_length=10, default='16:9')
    resolution = models.CharField(max_length=10, default='1080p')
    style = models.CharField(max_length=50, default='cinematic')

    # Veo-specific parameters
    veo_model_used = models.CharField(max_length=50)
    veo_seed = models.IntegerField(null=True, blank=True)
    camera_movement = models.CharField(max_length=100, blank=True)
    lighting_style = models.CharField(max_length=100, blank=True)

    # Output
    video_file = models.FileField(upload_to='video_clips/', blank=True, null=True)
    thumbnail = models.ImageField(upload_to='video_clips/thumbnails/', blank=True, null=True)
    audio_included = models.BooleanField(default=True)

    # Metadata
    file_size = models.BigIntegerField(default=0)  # bytes
    fps = models.IntegerField(default=30)
    codec = models.CharField(max_length=20, default='h264')

    # Selection for merging
    is_selected = models.BooleanField(default=False)
    order_index = models.IntegerField(default=0)

    # Status
    status = models.CharField(max_length=20, choices=[
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed')
    ], default='pending')

    error_message = models.TextField(blank=True, null=True)
    processing_time = models.FloatField(default=0)  # seconds
    generation_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)  # USD

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'video_studio_clips'
        ordering = ['order_index', '-created_at']

    def __str__(self):
        return f"Clip {self.id} - {self.project.name}"


class MergedVideo(models.Model):
    """Final merged video output"""
    project = models.ForeignKey(VideoProject, on_delete=models.CASCADE, related_name='merged_videos')

    # Input clips (ordered)
    clip_ids = models.JSONField(default=list)  # [1, 3, 5, 2]

    # Merge settings
    transition_type = models.CharField(max_length=20, choices=[
        ('cut', 'Hard Cut'),
        ('crossfade', 'Crossfade'),
        ('wipe', 'Wipe'),
        ('slide', 'Slide'),
        ('zoom', 'Zoom Transition')
    ], default='crossfade')

    transition_duration = models.FloatField(default=0.5)  # seconds

    # Output
    merged_video = models.FileField(upload_to='merged_videos/')
    thumbnail = models.ImageField(upload_to='merged_videos/thumbnails/', blank=True, null=True)

    # Metadata
    total_duration = models.FloatField(default=0)  # seconds
    file_size = models.BigIntegerField(default=0)  # bytes
    resolution = models.CharField(max_length=10)
    aspect_ratio = models.CharField(max_length=10)

    # Captions/Overlays
    has_captions = models.BooleanField(default=False)
    captions_data = models.JSONField(default=list, blank=True)

    # Music/Audio
    background_music = models.FileField(upload_to='music/', blank=True, null=True)
    music_volume = models.FloatField(default=0.3)  # 0-1

    # Status
    status = models.CharField(max_length=20, default='processing')
    processing_time = models.FloatField(default=0)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'video_studio_merged_videos'
        ordering = ['-created_at']

    def __str__(self):
        return f"Merged Video - {self.project.name}"


class PromptOptimizationLog(models.Model):
    """Track prompt optimizations for learning"""
    project = models.ForeignKey(VideoProject, on_delete=models.CASCADE, null=True, blank=True)
    brand = models.ForeignKey(Brand, on_delete=models.CASCADE, null=True, blank=True)

    original_prompt = models.TextField()
    optimized_prompt = models.TextField()
    optimization_model = models.CharField(max_length=50)  # 'gemini-2.5-pro'

    # Results
    video_quality_score = models.FloatField(null=True, blank=True)  # 1-10
    user_rating = models.IntegerField(null=True, blank=True)  # 1-5 stars
    was_regenerated = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'video_studio_prompt_logs'
        ordering = ['-created_at']


class VideoTemplate(models.Model):
    """Reusable video templates"""
    name = models.CharField(max_length=200)
    description = models.TextField()
    category = models.CharField(max_length=50)  # 'product_launch', 'social_ad', etc.

    # Template configuration
    clips_config = models.JSONField(default=list)  # List of clip configs
    transition_type = models.CharField(max_length=20)
    recommended_duration = models.IntegerField()

    # Availability
    is_global = models.BooleanField(default=False)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)

    # Preview
    preview_video = models.FileField(upload_to='templates/', blank=True, null=True)
    preview_thumbnail = models.ImageField(upload_to='templates/thumbs/', blank=True, null=True)

    # Usage stats
    times_used = models.IntegerField(default=0)
    avg_rating = models.FloatField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'video_studio_templates'
        ordering = ['-times_used', 'name']
```

---

## 6. API Integration Guide

### 🔌 Complete Veo Service Implementation

```python
# video_studio/services/veo_service.py

import base64
import time
import requests
from django.conf import settings
from django.core.files.base import ContentFile


class VeoVideoService:
    """
    Complete Google Veo API wrapper for SaleAnto
    """

    def __init__(self, api_key=None):
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"

        # Model selection
        self.MODELS = {
            'premium': 'veo-3.1-generate-preview',  # $0.40/sec
            'standard': 'veo-3.1-lite-generate-preview',  # $0.25/sec
            'fast': 'veo-3.1-fast',  # $0.15/sec (if available)
        }

    def generate_video(
        self,
        prompt,
        reference_image=None,
        duration=8,
        aspect_ratio='16:9',
        resolution='1080p',
        model_tier='standard',
        seed=None,
        generate_audio=True
    ):
        """
        Generate video using Veo API

        Args:
            prompt: Text description
            reference_image: Bytes of product image (optional)
            duration: Video length in seconds (always 8 for now)
            aspect_ratio: '16:9', '9:16', or '1:1'
            resolution: '720p', '1080p', or '4k'
            model_tier: 'premium', 'standard', or 'fast'
            seed: Optional seed for reproducibility
            generate_audio: Include audio in output

        Returns:
            {
                'success': True/False,
                'video_data': bytes,
                'duration': 8,
                'model_used': str,
                'cost': float,
                'processing_time': float
            }
        """
        if not self.api_key:
            return {'success': False, 'error': 'Gemini API key not configured'}

        start_time = time.time()

        try:
            # Select model
            model = self.MODELS.get(model_tier, self.MODELS['standard'])

            # Build request payload
            payload = self._build_payload(
                prompt=prompt,
                reference_image=reference_image,
                aspect_ratio=aspect_ratio,
                resolution=resolution,
                generate_audio=generate_audio,
                seed=seed
            )

            # Submit generation request
            operation_name = self._submit_generation(model, payload)

            if not operation_name:
                return {'success': False, 'error': 'Failed to submit generation request'}

            # Poll for completion
            result = self._poll_operation(operation_name, max_wait=600)  # 10 min max

            if result['success']:
                result['model_used'] = model
                result['processing_time'] = time.time() - start_time
                result['cost'] = self._calculate_cost(duration, model_tier, generate_audio)
                return result

            return result

        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'processing_time': time.time() - start_time
            }

    def _build_payload(self, prompt, reference_image, aspect_ratio, resolution, generate_audio, seed):
        """Build Veo API request payload"""

        # Build instance
        instance = {'prompt': prompt}

        # Add reference image if provided
        if reference_image:
            # Detect MIME type
            mime = self._detect_mime_type(reference_image)

            instance['image'] = {
                'inlineData': {
                    'data': base64.b64encode(reference_image).decode(),
                    'mimeType': mime
                }
            }

        # Build parameters
        parameters = {
            'aspectRatio': aspect_ratio,
            'resolution': resolution,
            'personGeneration': 'allow_adult',
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
        """Submit generation request to Veo API"""

        url = f"{self.base_url}/models/{model}:predictLongRunning"

        headers = {
            'Content-Type': 'application/json',
            'x-goog-api-key': self.api_key
        }

        try:
            response = requests.post(url, headers=headers, json=payload, timeout=60)

            if response.status_code == 200:
                return response.json().get('name')
            else:
                print(f"Veo API Error: {response.status_code} - {response.text}")
                return None

        except Exception as e:
            print(f"Failed to submit generation: {e}")
            return None

    def _poll_operation(self, operation_name, max_wait=600):
        """
        Poll long-running operation until complete

        Args:
            operation_name: Operation ID from submission
            max_wait: Maximum seconds to wait

        Returns:
            {
                'success': True/False,
                'video_data': bytes,
                'error': str (if failed)
            }
        """
        url = f"{self.base_url}/{operation_name}"
        headers = {'x-goog-api-key': self.api_key}

        elapsed = 0
        interval = 10  # Poll every 10 seconds

        while elapsed < max_wait:
            try:
                response = requests.get(url, headers=headers, timeout=30)

                if response.status_code != 200:
                    return {'success': False, 'error': f'Poll failed: {response.status_code}'}

                result = response.json()

                # Check if complete
                if not result.get('done'):
                    time.sleep(interval)
                    elapsed += interval
                    continue

                # Check for errors
                if 'error' in result:
                    error_msg = result['error'].get('message', 'Unknown error')
                    return {'success': False, 'error': error_msg}

                # Extract video
                video_uri = self._extract_video_uri(result)

                if video_uri:
                    video_data = self._download_video(video_uri)
                    if video_data:
                        return {
                            'success': True,
                            'video_data': video_data,
                            'duration': 8  # Veo always returns 8s
                        }
                    return {'success': False, 'error': 'Failed to download video'}

                return {'success': False, 'error': 'No video in completed operation'}

            except Exception as e:
                return {'success': False, 'error': str(e)}

        return {'success': False, 'error': f'Operation timed out after {max_wait}s'}

    def _extract_video_uri(self, result):
        """Extract video URI from Veo response"""

        response = result.get('response', {})

        # Try generateVideoResponse format (Veo 3.x)
        gen_resp = response.get('generateVideoResponse', {})
        samples = gen_resp.get('generatedSamples', [])

        if samples:
            return samples[0].get('video', {}).get('uri')

        # Try legacy predictions format
        if 'predictions' in response:
            for pred in response['predictions']:
                if 'bytesBase64Encoded' in pred:
                    # Video is inline (rare)
                    video_data = base64.b64decode(pred['bytesBase64Encoded'])
                    return video_data  # Return bytes directly

        return None

    def _download_video(self, uri):
        """Download video from Veo-provided URI"""

        # If already bytes, return
        if isinstance(uri, bytes):
            return uri

        try:
            # Try with auth header first
            headers = {'x-goog-api-key': self.api_key}
            response = requests.get(uri, headers=headers, timeout=120)

            if response.status_code == 200:
                return response.content

            # Try without auth (some URIs are public)
            response = requests.get(uri, timeout=120)
            if response.status_code == 200:
                return response.content

            return None

        except Exception as e:
            print(f"Failed to download video: {e}")
            return None

    def _detect_mime_type(self, image_bytes):
        """Detect image MIME type from bytes"""

        if image_bytes[:3] == b'\xff\xd8\xff':
            return 'image/jpeg'
        elif image_bytes[:4] == b'\x89PNG':
            return 'image/png'
        elif image_bytes[:4] == b'RIFF':
            return 'image/webp'
        else:
            return 'image/jpeg'  # Default

    def _calculate_cost(self, duration, model_tier, has_audio):
        """Calculate generation cost in USD"""

        costs_per_second = {
            'premium': 0.40,
            'standard': 0.25,
            'fast': 0.15
        }

        cost_per_sec = costs_per_second.get(model_tier, 0.25)

        # Veo includes audio in base price
        total_cost = duration * cost_per_sec

        return round(total_cost, 2)

    # Extension methods

    def extend_video(self, previous_video_path, continuation_prompt):
        """
        Extend existing video with new clip
        (Veo uses last 1 second as reference)
        """
        # Extract last second of video
        last_second = self._extract_last_second(previous_video_path)

        # Generate continuation
        return self.generate_video(
            prompt=continuation_prompt,
            reference_image=last_second,  # Use last frame
            duration=8
        )

    def generate_with_frame_control(self, start_frame, end_frame, prompt):
        """
        Generate video from start frame to end frame
        (Veo 3.1 feature)
        """
        payload = {
            'instances': [{
                'prompt': prompt,
                'firstFrame': {
                    'inlineData': {
                        'data': base64.b64encode(start_frame).decode(),
                        'mimeType': 'image/jpeg'
                    }
                },
                'lastFrame': {
                    'inlineData': {
                        'data': base64.b64encode(end_frame).decode(),
                        'mimeType': 'image/jpeg'
                    }
                }
            }],
            'parameters': {
                'aspectRatio': '16:9',
                'resolution': '1080p'
            }
        }

        # Submit and poll
        operation_name = self._submit_generation('veo-3.1-generate-preview', payload)
        return self._poll_operation(operation_name)
```

---

### 📡 API Usage Examples

```python
# Example 1: Basic text-to-video
veo = VeoVideoService(api_key='YOUR_API_KEY')

result = veo.generate_video(
    prompt="Cinematic product shot of wireless headphones rotating 360 degrees",
    duration=8,
    aspect_ratio='16:9',
    resolution='1080p',
    model_tier='standard'
)

if result['success']:
    with open('output.mp4', 'wb') as f:
        f.write(result['video_data'])
    print(f"Generated in {result['processing_time']:.1f}s, Cost: ${result['cost']}")


# Example 2: Image-to-video (product showcase)
with open('product.jpg', 'rb') as f:
    product_image = f.read()

result = veo.generate_video(
    prompt="Smooth camera orbit around product with studio lighting",
    reference_image=product_image,
    duration=8,
    aspect_ratio='1:1',  # Instagram square
    resolution='1080p',
    model_tier='premium'
)


# Example 3: Video extension (create longer videos)
result1 = veo.generate_video(prompt="Product reveal from left")
result2 = veo.extend_video(
    previous_video_path='clip1.mp4',
    continuation_prompt="Camera zooms in to show details"
)

# Merge result1 + result2 = 16-second video


# Example 4: Frame control (precise start/end)
with open('front.jpg', 'rb') as f:
    start_frame = f.read()
with open('back.jpg', 'rb') as f:
    end_frame = f.read()

result = veo.generate_with_frame_control(
    start_frame=start_frame,
    end_frame=end_frame,
    prompt="Smooth rotation from front to back view"
)
```

---

## 7. BrandDNA Integration

### 🧬 Prompt Enhancement Pipeline

```python
# video_studio/services/prompt_builder.py

from PIL import Image
import colorsys
import numpy as np


class BrandDNAPromptBuilder:
    """
    Inject BrandDNA context into Veo prompts
    """

    def build_enhanced_prompt(self, user_prompt, brand, product_image=None, workspace=None):
        """
        Main method: User prompt + BrandDNA → Enhanced Veo prompt
        """

        # 1. Extract BrandDNA components
        brand_context = self._extract_brand_context(brand)

        # 2. Analyze product image (if provided)
        product_analysis = None
        if product_image:
            product_analysis = self._analyze_product_image(product_image)

        # 3. Get workspace preferences
        workspace_prefs = self._get_workspace_preferences(workspace) if workspace else {}

        # 4. Build structured prompt
        enhanced = self._construct_veo_prompt(
            user_prompt=user_prompt,
            brand_context=brand_context,
            product_analysis=product_analysis,
            workspace_prefs=workspace_prefs
        )

        return enhanced

    def _extract_brand_context(self, brand):
        """Extract relevant info from Brand model"""

        brand_dna = brand.brand_dna or {}

        return {
            'name': brand.brand_name,
            'industry': brand.industry,
            'voice_tone': brand.voice_tone,

            # From BrandDNA JSON
            'primary_color': brand_dna.get('primary_color', '#000000'),
            'secondary_color': brand_dna.get('secondary_color', '#FFFFFF'),
            'color_palette': brand_dna.get('color_palette', []),

            'visual_style': brand_dna.get('visual_style', 'modern'),
            'mood': brand_dna.get('mood', 'professional'),

            # Target audience
            'audiences': brand.audiences or [],
            'goals': brand.goals or []
        }

    def _analyze_product_image(self, image_path):
        """
        Analyze product image for visual properties
        """
        img = Image.open(image_path).convert('RGB')
        img_array = np.array(img)

        # 1. Extract dominant colors
        dominant_colors = self._get_dominant_colors(img_array, k=5)

        # 2. Calculate brightness/lighting
        brightness = np.mean(img_array)

        if brightness > 200:
            lighting = 'bright, high-key, well-lit'
        elif brightness > 150:
            lighting = 'balanced, natural'
        elif brightness > 100:
            lighting = 'moderate, soft'
        else:
            lighting = 'dark, low-key, moody'

        # 3. Detect background type
        background = self._detect_background_type(img_array)

        # 4. Color temperature
        avg_rgb = np.mean(img_array, axis=(0, 1))
        if avg_rgb[0] > avg_rgb[2]:  # More red than blue
            temperature = 'warm tones'
        else:
            temperature = 'cool tones'

        return {
            'dominant_colors': dominant_colors,
            'brightness': round(brightness, 1),
            'lighting': lighting,
            'background': background,
            'temperature': temperature
        }

    def _get_dominant_colors(self, img_array, k=5):
        """Extract k dominant colors using k-means"""
        from sklearn.cluster import KMeans

        # Reshape image
        pixels = img_array.reshape(-1, 3)

        # Sample pixels (for performance)
        sample_size = min(10000, len(pixels))
        sampled = pixels[np.random.choice(len(pixels), sample_size, replace=False)]

        # K-means clustering
        kmeans = KMeans(n_clusters=k, random_state=42)
        kmeans.fit(sampled)

        # Get dominant colors
        colors = kmeans.cluster_centers_.astype(int)

        # Convert to hex
        hex_colors = [self._rgb_to_hex(c) for c in colors]

        # Convert to color names
        color_names = [self._hex_to_color_name(h) for h in hex_colors]

        return color_names

    def _rgb_to_hex(self, rgb):
        """Convert RGB to hex"""
        return '#{:02x}{:02x}{:02x}'.format(rgb[0], rgb[1], rgb[2])

    def _hex_to_color_name(self, hex_color):
        """Convert hex to descriptive color name"""
        # Simplified color naming
        r, g, b = int(hex_color[1:3], 16), int(hex_color[3:5], 16), int(hex_color[5:7], 16)

        h, s, v = colorsys.rgb_to_hsv(r/255, g/255, b/255)

        # Determine color
        if s < 0.1:
            if v > 0.9:
                return 'white'
            elif v < 0.1:
                return 'black'
            else:
                return 'gray'

        hue_names = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink']
        hue_index = int(h * 8) % 8

        return hue_names[hue_index]

    def _detect_background_type(self, img_array):
        """Detect if background is plain, gradient, or complex"""

        # Calculate color variance
        variance = np.var(img_array, axis=(0, 1))
        avg_variance = np.mean(variance)

        if avg_variance < 100:
            return 'solid/plain background'
        elif avg_variance < 1000:
            return 'gradient background'
        else:
            return 'textured/complex background'

    def _get_workspace_preferences(self, workspace):
        """Extract workspace-level preferences"""
        return {
            'default_language': workspace.default_language,
            'timezone': workspace.timezone
        }

    def _construct_veo_prompt(self, user_prompt, brand_context, product_analysis, workspace_prefs):
        """
        Build final enhanced prompt for Veo
        """

        # Start with user's prompt
        prompt_parts = [user_prompt]

        # Add brand visual style
        visual_style = self._get_visual_style_description(brand_context)
        prompt_parts.append(f"\n\nVisual Style: {visual_style}")

        # Add color guidance
        if brand_context['color_palette']:
            colors_desc = ', '.join(brand_context['color_palette'][:3])
            prompt_parts.append(f"Brand Colors: Incorporate {colors_desc} palette")

        # Add product-specific lighting
        if product_analysis:
            prompt_parts.append(f"Lighting: {product_analysis['lighting']}, matching product image")
            prompt_parts.append(f"Color Temperature: {product_analysis['temperature']}")

        # Add mood/tone
        mood = brand_context.get('mood', 'professional')
        prompt_parts.append(f"Mood: {mood}, {brand_context['voice_tone']}")

        # Add industry-specific guidance
        industry_style = self._get_industry_style(brand_context['industry'])
        if industry_style:
            prompt_parts.append(f"Industry Style: {industry_style}")

        # Technical requirements
        prompt_parts.append("\n\nTechnical Requirements:")
        prompt_parts.append("- Duration: 8 seconds")
        prompt_parts.append("- Quality: Professional, cinematic")
        prompt_parts.append("- Camera: Smooth, intentional movements")
        prompt_parts.append("- Audio: Subtle ambient sound")

        # Combine all parts
        final_prompt = '\n'.join(prompt_parts)

        # Ensure within Veo's character limit (~500 chars recommended)
        if len(final_prompt) > 500:
            final_prompt = self._compress_prompt(final_prompt, max_length=500)

        return final_prompt

    def _get_visual_style_description(self, brand_context):
        """Convert brand voice to visual style"""

        style_map = {
            'professional': 'Clean, modern, sophisticated cinematography',
            'casual': 'Relaxed, natural, approachable visuals',
            'playful': 'Dynamic, colorful, energetic camera work',
            'elegant': 'Refined, graceful, high-end aesthetic',
            'bold': 'Striking, confident, dramatic visuals',
            'minimalist': 'Simple, uncluttered, focused composition',
        }

        tone = brand_context.get('voice_tone', 'professional')
        return style_map.get(tone, 'Professional, high-quality')

    def _get_industry_style(self, industry):
        """Industry-specific visual guidance"""

        industry_styles = {
            'technology': 'Modern, sleek, futuristic with clean lines',
            'fashion': 'Stylish, trend-forward, elegant presentation',
            'food & beverage': 'Appetizing, vibrant colors, natural lighting',
            'beauty': 'Soft, flattering lighting, luxurious feel',
            'sports': 'Dynamic, energetic, action-focused',
            'automotive': 'Powerful, sleek, cinematic reveals',
            'real estate': 'Spacious, inviting, well-lit interiors',
        }

        return industry_styles.get(industry.lower(), None)

    def _compress_prompt(self, prompt, max_length=500):
        """Compress prompt if too long while keeping key info"""

        # Remove extra whitespace
        compressed = ' '.join(prompt.split())

        if len(compressed) <= max_length:
            return compressed

        # Truncate and add ellipsis
        return compressed[:max_length-3] + '...'


# Usage example
builder = BrandDNAPromptBuilder()

enhanced_prompt = builder.build_enhanced_prompt(
    user_prompt="360° rotation of product",
    brand=brand_instance,
    product_image='path/to/product.jpg',
    workspace=workspace_instance
)

print(enhanced_prompt)
```

**Output Example:**
```
360° rotation of product

Visual Style: Clean, modern, sophisticated cinematography
Brand Colors: Incorporate blue, white, silver palette
Lighting: bright, high-key, well-lit, matching product image
Color Temperature: cool tones
Mood: professional, professional
Industry Style: Modern, sleek, futuristic with clean lines

Technical Requirements:
- Duration: 8 seconds
- Quality: Professional, cinematic
- Camera: Smooth, intentional movements
- Audio: Subtle ambient sound
```

---

## 8. Video Merging System

### 🎞️ MoviePy-based Merge Service

```python
# video_studio/services/merge_service.py

from moviepy.editor import (
    VideoFileClip,
    concatenate_videoclips,
    CompositeVideoClip,
    TextClip,
    AudioFileClip
)
from moviepy.video.fx import fadein, fadeout
import os


class VideoMergeService:
    """
    Professional video merging with transitions
    """

    def merge_clips(
        self,
        clip_paths,
        transition_type='crossfade',
        transition_duration=0.5,
        add_captions=False,
        captions_data=None,
        background_music=None,
        music_volume=0.3
    ):
        """
        Merge multiple video clips into one

        Args:
            clip_paths: List of video file paths in order
            transition_type: 'cut', 'crossfade', 'wipe', 'slide', 'zoom'
            transition_duration: Seconds for transition
            add_captions: Whether to add text overlays
            captions_data: List of caption dicts
            background_music: Path to music file
            music_volume: Volume level (0-1)

        Returns:
            str: Path to merged video
        """

        # Load all clips
        clips = [VideoFileClip(path) for path in clip_paths]

        # Apply transitions
        if transition_type == 'cut':
            final = concatenate_videoclips(clips, method='chain')
        elif transition_type == 'crossfade':
            final = self._crossfade_merge(clips, transition_duration)
        elif transition_type == 'wipe':
            final = self._wipe_merge(clips, transition_duration)
        elif transition_type == 'slide':
            final = self._slide_merge(clips, transition_duration)
        else:
            final = concatenate_videoclips(clips)

        # Add captions if requested
        if add_captions and captions_data:
            final = self._add_captions(final, captions_data)

        # Add background music
        if background_music:
            final = self._add_background_music(final, background_music, music_volume)

        # Export
        output_path = f'/tmp/merged_{os.urandom(8).hex()}.mp4'
        final.write_videofile(
            output_path,
            codec='libx264',
            audio_codec='aac',
            fps=30,
            preset='medium',
            bitrate='5000k',
            threads=4
        )

        # Cleanup
        for clip in clips:
            clip.close()
        final.close()

        return output_path

    def _crossfade_merge(self, clips, duration):
        """Crossfade transition between clips"""

        if len(clips) == 1:
            return clips[0]

        # Apply fadeout to all except last
        for i in range(len(clips) - 1):
            clips[i] = clips[i].fx(fadeout, duration)

        # Apply fadein to all except first
        for i in range(1, len(clips)):
            clips[i] = clips[i].fx(fadein, duration)

        # Calculate positions (overlapping by duration)
        current_time = 0
        positioned_clips = []

        for i, clip in enumerate(clips):
            clip = clip.set_start(current_time)
            positioned_clips.append(clip)

            if i < len(clips) - 1:
                current_time += clip.duration - duration
            else:
                current_time += clip.duration

        return CompositeVideoClip(positioned_clips)

    def _wipe_merge(self, clips, duration):
        """Wipe transition (left to right)"""

        # Simplified wipe - use masks
        positioned_clips = []
        current_time = 0

        for i, clip in enumerate(clips):
            if i > 0:
                # Create wipe mask
                clip = clip.set_start(current_time - duration)
                # Add custom mask logic here
            else:
                clip = clip.set_start(current_time)

            positioned_clips.append(clip)
            current_time += clip.duration - (duration if i < len(clips) - 1 else 0)

        return CompositeVideoClip(positioned_clips)

    def _slide_merge(self, clips, duration):
        """Slide transition (new clip slides in)"""

        # Implement slide transition
        # Similar to wipe but with position animation
        return concatenate_videoclips(clips)  # Simplified

    def _add_captions(self, video, captions_data):
        """
        Add text captions to video

        captions_data format:
        [
            {
                'text': 'Caption text',
                'start': 0,
                'duration': 3,
                'position': 'bottom',
                'fontsize': 50,
                'color': 'white'
            },
            ...
        ]
        """

        text_clips = []

        for caption in captions_data:
            txt_clip = TextClip(
                caption['text'],
                fontsize=caption.get('fontsize', 50),
                color=caption.get('color', 'white'),
                font=caption.get('font', 'Arial-Bold'),
                stroke_color=caption.get('stroke_color', 'black'),
                stroke_width=caption.get('stroke_width', 2),
                method='caption',
                size=(video.w * 0.8, None)
            )

            # Position
            position = caption.get('position', 'bottom')
            if position == 'bottom':
                txt_clip = txt_clip.set_position(('center', video.h - 100))
            elif position == 'top':
                txt_clip = txt_clip.set_position(('center', 50))
            elif position == 'center':
                txt_clip = txt_clip.set_position('center')

            txt_clip = txt_clip.set_start(caption['start']).set_duration(caption['duration'])
            text_clips.append(txt_clip)

        return CompositeVideoClip([video] + text_clips)

    def _add_background_music(self, video, music_path, volume=0.3):
        """Add background music to video"""

        audio = AudioFileClip(music_path)

        # Loop music if shorter than video
        if audio.duration < video.duration:
            n_loops = int(video.duration / audio.duration) + 1
            audio = concatenate_audioclips([audio] * n_loops)

        # Trim to video length
        audio = audio.subclip(0, video.duration)

        # Adjust volume
        audio = audio.volumex(volume)

        # Mix with original audio if exists
        if video.audio:
            final_audio = CompositeAudioClip([video.audio, audio])
        else:
            final_audio = audio

        return video.set_audio(final_audio)

    # Advanced features

    def add_logo_watermark(self, video_path, logo_path, position='bottom-right', opacity=0.7):
        """Add brand logo to video"""

        from moviepy.editor import ImageClip

        video = VideoFileClip(video_path)
        logo = ImageClip(logo_path).set_opacity(opacity)

        # Resize logo
        logo = logo.resize(height=int(video.h * 0.1))

        # Position
        if position == 'bottom-right':
            logo = logo.set_position((video.w - logo.w - 20, video.h - logo.h - 20))
        elif position == 'bottom-left':
            logo = logo.set_position((20, video.h - logo.h - 20))
        # Add more positions...

        logo = logo.set_duration(video.duration)

        final = CompositeVideoClip([video, logo])

        output_path = video_path.replace('.mp4', '_watermarked.mp4')
        final.write_videofile(output_path, codec='libx264')

        return output_path
```

---

## 9. E-commerce Optimization

### 🛍️ Product Video Best Practices

Based on research, here are proven strategies:

#### **1. Video Duration Strategy**

| Platform | Optimal Duration | Rationale |
|----------|------------------|-----------|
| Instagram Feed | 8-15s | Short attention span |
| Instagram Story | 8s | Per-story limit |
| TikTok | 8-15s | Hook in first 1.5s |
| YouTube Shorts | 15-30s | Slightly longer tolerance |
| Amazon Product Page | 30-60s | Educational focus |
| Website PDP | 15-30s | Showcase features |
| Email | 8-10s | Load time critical |

**SaleAnto Implementation:**
```python
DURATION_PRESETS = {
    'instagram_feed': 10,
    'instagram_story': 8,
    'tiktok': 12,
    'youtube_shorts': 20,
    'amazon': 45,
    'website': 20,
    'email': 8
}
```

---

#### **2. Video Structure Framework**

**The 3-Second Rule:**
- **0-1.5s**: Hook (attention grabber)
- **1.5-6s**: Product showcase
- **6-8s**: CTA or brand logo

```python
VIDEO_STRUCTURES = {
    'product_launch': {
        'hook': {
            'type': 'dramatic_reveal',
            'duration': 2,
            'prompt': 'Explosive product reveal with dynamic lighting'
        },
        'showcase': {
            'type': '360_rotation',
            'duration': 4,
            'prompt': 'Smooth orbit showing all product angles'
        },
        'cta': {
            'type': 'brand_logo',
            'duration': 2,
            'prompt': 'Brand logo with subtle animation'
        }
    },

    'social_ad': {
        'hook': {
            'type': 'problem',
            'duration': 1.5,
            'prompt': 'Show problem user faces'
        },
        'showcase': {
            'type': 'solution',
            'duration': 5,
            'prompt': 'Product solving the problem'
        },
        'cta': {
            'type': 'text_overlay',
            'duration': 1.5,
            'text': 'Shop Now'
        }
    }
}
```

---

#### **3. Color & Lighting Guidelines**

**Product Type → Lighting Style:**

```python
PRODUCT_LIGHTING_MAP = {
    'jewelry': 'Dramatic spotlight, high contrast, sparkle highlights',
    'electronics': 'Clean studio lighting, minimal shadows, tech-forward',
    'food': 'Natural warm lighting, appetizing colors, soft shadows',
    'fashion': 'Soft diffused lighting, flattering, elegant',
    'beauty': 'Even soft lighting, color-accurate, glowing',
    'home_decor': 'Warm ambient lighting, cozy atmosphere',
    'toys': 'Bright colorful lighting, playful, energetic',
}

def get_lighting_for_product(product_category):
    return PRODUCT_LIGHTING_MAP.get(product_category, 'Balanced natural lighting')
```

---

#### **4. Camera Movement Psychology**

**Movement → Emotion:**

| Camera Move | Emotion Evoked | Best For |
|-------------|----------------|----------|
| Slow dolly-in | Intimacy, focus | Luxury products |
| Fast zoom | Excitement | New launches |
| Orbit/360° | Comprehensive view | All products |
| Static close-up | Detail, quality | High-end items |
| Handheld | Authenticity | Lifestyle videos |
| Crane up | Grandeur | Real estate, large items |

```python
CAMERA_EMOTION_MAP = {
    'luxury': 'Slow dolly-in, elegant crane movements',
    'exciting': 'Fast zoom, dynamic pans',
    'trustworthy': 'Steady static shots, no shake',
    'authentic': 'Subtle handheld, natural movement',
    'comprehensive': 'Smooth 360° orbit'
}
```

---

#### **5. Sound Strategy**

**Audio Types for E-commerce:**

- **Ambient/Natural**: Product usage sounds (clicking, pouring, etc.)
- **Music**: Subtle background (avoid overpowering)
- **Voiceover**: Product benefits (rare in 8s clips)
- **ASMR**: Satisfying sounds (unboxing, texture)

```python
AUDIO_STRATEGIES = {
    'silent': {
        'description': 'No audio (auto-play friendly)',
        'platforms': ['instagram_feed', 'facebook'],
        'veo_param': {'generateAudio': False}
    },

    'ambient': {
        'description': 'Natural product sounds only',
        'platforms': ['website', 'amazon'],
        'veo_prompt_addition': 'subtle ambient product sounds, no music'
    },

    'music': {
        'description': 'Background music + ambient',
        'platforms': ['youtube_shorts', 'tiktok'],
        'veo_prompt_addition': 'upbeat background music, energetic'
    },

    'asmr': {
        'description': 'Satisfying textured sounds',
        'platforms': ['tiktok'],
        'veo_prompt_addition': 'ASMR-style satisfying sounds, texture focus'
    }
}
```

---

#### **6. Conversion Optimization Tactics**

**Proven Tactics:**

1. **Show Product in Context**
   - 72% higher conversion when showing product in use
   ```python
   'lifestyle_shot': 'Person using {product} in natural setting, relatable scenario'
   ```

2. **Multiple Angles**
   - Include 360° view increases trust by 35%
   ```python
   'must_have_angles': ['front', '360_rotation', 'detail_closeup', 'in_use']
   ```

3. **Size Reference**
   - Show product next to common item for scale
   ```python
   'scale_reference': '{product} next to coffee mug for size comparison'
   ```

4. **Before/After** (if applicable)
   - Highly effective for beauty, cleaning, fitness products
   ```python
   'before_after': 'Split screen before and after using {product}'
   ```

---

#### **7. Platform-Specific Optimization**

```python
class PlatformOptimizer:
    """
    Optimize video for specific platform requirements
    """

    PLATFORM_SPECS = {
        'instagram_feed': {
            'aspect_ratio': '1:1',  # or '4:5'
            'duration': (8, 15),  # min, max
            'style': 'Vibrant, eye-catching, stop-scroll',
            'captions': 'Required (85% watch without sound)',
            'hook_time': 1.5,  # seconds to grab attention
            'cta': 'Swipe up / Link in bio'
        },

        'instagram_story': {
            'aspect_ratio': '9:16',
            'duration': (5, 8),
            'style': 'Vertical, immersive, full-screen',
            'captions': 'Optional but recommended',
            'hook_time': 1.0,
            'cta': 'Swipe up link'
        },

        'tiktok': {
            'aspect_ratio': '9:16',
            'duration': (8, 15),
            'style': 'Trendy, fast-paced, authentic',
            'captions': 'Built-in text essential',
            'hook_time': 1.5,
            'cta': 'Link in bio / Shop now button',
            'music': 'Trending sounds increase visibility'
        },

        'youtube_shorts': {
            'aspect_ratio': '9:16',
            'duration': (15, 30),
            'style': 'Engaging, hook-first, educational',
            'captions': 'Recommended',
            'hook_time': 3.0,
            'cta': 'Link in description'
        },

        'amazon_product_page': {
            'aspect_ratio': '16:9',
            'duration': (30, 60),
            'style': 'Informative, professional, feature-focused',
            'captions': 'Optional',
            'requirements': 'Show product in use, answer FAQs',
            'cta': 'Not needed (on product page)'
        },

        'website_pdp': {
            'aspect_ratio': '16:9',
            'duration': (15, 30),
            'style': 'Clean, professional, showcase',
            'autoplay': True,
            'muted': True,
            'loop': True
        }
    }

    def optimize_for_platform(self, base_prompt, platform):
        """
        Modify prompt based on platform requirements
        """
        specs = self.PLATFORM_SPECS.get(platform, {})

        enhanced_prompt = f"""
{base_prompt}

Platform Optimization:
- Platform: {platform}
- Style: {specs.get('style', 'Professional')}
- Aspect Ratio: {specs.get('aspect_ratio', '16:9')}
- Duration: {specs.get('duration', (8, 8))[0]} seconds
- Hook within: {specs.get('hook_time', 2)} seconds
- {"Include captions" if specs.get('captions') == 'Required' else ""}
"""

        return enhanced_prompt
```

---

#### **8. A/B Testing Framework**

```python
class VideoABTesting:
    """
    Generate A/B test variants automatically
    """

    def generate_test_variants(self, base_config, test_variables):
        """
        Create variants for testing

        test_variables example:
        {
            'camera_angle': ['front', 'aerial', 'closeup'],
            'lighting': ['bright', 'moody'],
            'speed': ['slow_motion', 'normal', 'fast']
        }
        """

        variants = []

        # Generate all combinations
        import itertools
        keys = test_variables.keys()
        values = test_variables.values()

        for combination in itertools.product(*values):
            variant_config = base_config.copy()
            variant_config.update(dict(zip(keys, combination)))
            variants.append(variant_config)

        return variants

    def track_variant_performance(self, variant_id, metrics):
        """
        Track which variants perform best

        metrics: {
            'views': 1000,
            'engagement_rate': 0.15,
            'click_through_rate': 0.05,
            'conversion_rate': 0.02
        }
        """

        ABTestResult.objects.create(
            variant_id=variant_id,
            views=metrics['views'],
            engagement_rate=metrics['engagement_rate'],
            ctr=metrics.get('click_through_rate', 0),
            conversion_rate=metrics.get('conversion_rate', 0)
        )

    def get_winning_variant(self, test_id):
        """
        Identify best-performing variant
        """
        results = ABTestResult.objects.filter(test_id=test_id)

        # Score based on weighted metrics
        for result in results:
            result.score = (
                result.engagement_rate * 0.3 +
                result.ctr * 0.3 +
                result.conversion_rate * 0.4
            )

        winner = max(results, key=lambda x: x.score)
        return winner
```

---

## 10. Implementation Roadmap

### 🗺️ 6-Week Development Plan

#### **Week 1: Foundation**
- [ ] Create `video_studio` Django app
- [ ] Define database models (VideoProject, VideoClip, MergedVideo)
- [ ] Set up migrations
- [ ] Install dependencies (`moviepy`, `rembg`, `Pillow`)
- [ ] Configure Celery for async tasks

#### **Week 2: Veo API Integration**
- [ ] Implement `VeoVideoService` class
- [ ] Add image-to-video support
- [ ] Test API with different parameters
- [ ] Implement error handling and retries
- [ ] Add cost tracking

#### **Week 3: BrandDNA & Prompt Building**
- [ ] Implement `BrandDNAPromptBuilder`
- [ ] Add product image analysis
- [ ] Create prompt optimization with Gemini
- [ ] Build prompt template library
- [ ] Test with real brand data

#### **Week 4: Video Generation & Celery**
- [ ] Create Celery tasks for async generation
- [ ] Implement batch generation queue
- [ ] Add progress tracking (WebSocket or polling)
- [ ] Build clip management views
- [ ] Test concurrent generation

#### **Week 5: Video Merging**
- [ ] Implement `VideoMergeService` with MoviePy
- [ ] Add transition effects (crossfade, wipe, slide)
- [ ] Implement caption overlay system
- [ ] Add background music mixing
- [ ] Test different merge configurations

#### **Week 6: Frontend & Polish**
- [ ] Build React components (ProjectSetup, ClipGenerator, MergeEditor)
- [ ] Implement drag-and-drop clip reordering
- [ ] Add video preview player
- [ ] Create export & download UI
- [ ] Integration testing & bug fixes

---

### 🔧 Dependencies Installation

```bash
# Python packages
pip install moviepy==1.0.3
pip install rembg==2.0.50  # Background removal
pip install Pillow==10.0.0
pip install celery==5.3.0
pip install redis==5.0.0
pip install scikit-learn==1.3.0  # For color clustering
pip install requests==2.31.0
pip install google-generativeai==0.3.0  # For Gemini API

# System dependencies (Ubuntu/Debian)
sudo apt-get install ffmpeg imagemagick

# Redis for Celery
sudo apt-get install redis-server
```

---

## 11. Cost Analysis

### 💰 Pricing Breakdown

#### **Veo API Costs**

| Scenario | Model | Videos/Month | Cost/Month |
|----------|-------|--------------|------------|
| **Small Business** | Fast | 100 clips (8s each) | $120 |
| **Medium Business** | Standard | 500 clips | $1,000 |
| **Enterprise** | Premium | 2,000 clips | $6,400 |

**Per Video:**
- Single 8s clip: $1.20 (Fast) - $3.20 (Premium)
- 4-clip merged video (32s): $4.80 (Fast) - $12.80 (Premium)

---

#### **Optimization Strategies**

1. **Use Fast Model for Bulk/Testing**
   ```python
   if is_test_generation:
       model_tier = 'fast'  # $1.20 per clip
   else:
       model_tier = 'standard'  # $2.00 per clip
   ```

2. **Cache Common Prompts**
   ```python
   # Reuse seed for identical prompts
   if prompt in cache:
       return cache[prompt]  # $0
   ```

3. **Batch Generation**
   ```python
   # Generate all clips in one session
   # Saves on API overhead
   ```

4. **Progressive Quality**
   ```python
   # Start with 720p, upgrade to 1080p only if needed
   resolution = '720p' if preview else '1080p'
   ```

---

#### **ROI Comparison**

**Traditional Video Production:**
- Freelancer: $500-2,000 per video
- Agency: $2,000-10,000 per video
- Turnaround: 5-10 days

**SaleAnto Video Engine:**
- AI-generated: $5-15 per video
- Turnaround: 20 minutes
- **Savings: 95-99%**

---

## 12. Best Practices

### ✅ Do's

1. **Always Use BrandDNA**
   - Ensures brand consistency
   - Better results with context

2. **Start with Fast Model for Testing**
   - Iterate quickly
   - Upgrade to Premium for final

3. **Use Reference Images**
   - Product photos as start frame
   - Higher consistency

4. **Optimize Prompts with Gemini**
   - Better Veo output
   - Learn from successful prompts

5. **Test Multiple Variations**
   - A/B test different styles
   - Track performance

6. **Add Captions for Social**
   - 85% watch without sound
   - Increases engagement

### ❌ Don'ts

1. **Don't Generate Without Context**
   - Generic prompts = generic output
   - Always inject brand/product info

2. **Don't Ignore Platform Specs**
   - Wrong aspect ratio = cropped video
   - Follow platform guidelines

3. **Don't Over-compress**
   - Maintain quality for branding
   - Bitrate minimum: 5000k

4. **Don't Skip Product Image Prep**
   - Remove backgrounds
   - Center and optimize

5. **Don't Overuse Transitions**
   - Simple is better
   - Crossfade for most cases

---

## 13. Future Enhancements

### 🚀 Phase 2 Features

#### **1. AI Video Editing**
- Auto-detect best frames from generated clips
- Smart clip trimming based on engagement data
- AI-powered color grading matching brand colors

#### **2. Voiceover Integration**
- Text-to-speech for product descriptions
- Multiple voice options (male/female, accents)
- Sync with video visuals

#### **3. Advanced Analytics**
- Heatmaps showing drop-off points
- A/B test results dashboard
- ROI tracking per video

#### **4. Social Media Direct Publishing**
- Auto-post to Instagram, TikTok, YouTube
- Schedule video campaigns
- Track performance across platforms

#### **5. Template Marketplace**
- User-created templates
- Industry-specific bundles
- Premium template store

#### **6. Collaborative Editing**
- Team member review/approval
- Comment threads on clips
- Version control

#### **7. Advanced Veo Features**
- Multi-shot videos (camera angle changes)
- Character consistency across clips
- Scene composition control

#### **8. Video SEO Optimization**
- Auto-generate video titles/descriptions
- Keyword optimization
- Thumbnail A/B testing

---

### 🔮 Phase 3 Features (Future)

1. **Live Video Customization**
   - Real-time parameter adjustments
   - Interactive video generation

2. **AR Product Placement**
   - Place products in virtual environments
   - Try-before-you-buy videos

3. **AI Storyboarding**
   - Auto-generate video scripts
   - Shot-by-shot planning

4. **User-Generated Content Integration**
   - Combine UGC with AI clips
   - Authentic testimonial videos

5. **Multi-Language Support**
   - Auto-translate captions
   - Localized product videos

---

## 📚 Resources

### Official Documentation
- [Veo 3.1 API Docs](https://ai.google.dev/gemini-api/docs/video)
- [MoviePy Documentation](https://zulko.github.io/moviepy/)
- [Gemini API Docs](https://ai.google.dev/gemini-api/docs)

### Tutorials
- [E-commerce Video Best Practices](https://www.gotolstoy.com/blog/ai-product-videos)
- [MoviePy Video Editing](https://www.educative.io/answers/how-to-add-transitions-using-moviepy)

### Tools
- [Veo Playground](https://aistudio.google.com/models/veo-3)
- [Gemini AI Studio](https://aistudio.google.com/)

---

## 📞 Support & Contact

**Questions about this implementation?**
- GitHub Issues: [Your repo]
- Email: [support@sellanto.com]
- Documentation: [docs.sellanto.com/video-engine]

---

## 🎉 Conclusion

SaleAnto Video Engine is a comprehensive AI-powered video generation system that leverages Google Veo 3.1 to create professional e-commerce product videos at scale. With BrandDNA integration, workspace context, and advanced merging capabilities, it delivers consistent, high-quality videos optimized for every major platform.

**Key Benefits:**
- ✅ 95% cost reduction vs. traditional production
- ✅ 20-minute turnaround (vs. 5-10 days)
- ✅ Brand-consistent output
- ✅ Platform-optimized formats
- ✅ Scalable to 1000s of products

Start generating videos today and transform your e-commerce content strategy!

---

**Last Updated:** April 30, 2026
**Version:** 1.0
**Next Review:** May 30, 2026