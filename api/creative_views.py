import json
import logging

import openai
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone

from accounts.permissions import IsCreatorOrAbove, IsViewerOrAbove
from accounts.services.notification_service import notify_images_ready

from ai_image.models import ImageGeneration, AssetPlatformVariant, CreativeVersionHistory
from posts.models import Post, PostCaption, PostHashtag
from brands.models import BrandTemplate
from accounts.api_keys import get_openai_key
from ai_image.services.alt_text_service import generate_alt_text
from ai_image.services.resize_service import resize_image_for_platforms
from ai_image.services.template_service import apply_brand_template

logger = logging.getLogger(__name__)


class GenerateAltTextView(APIView):
    """Generate accessibility alt text for an image using LLM vision"""
    permission_classes = [IsAuthenticated, IsCreatorOrAbove]

    def post(self, request, asset_id):
        try:
            asset = ImageGeneration.objects.get(id=asset_id, user=request.user)
        except ImageGeneration.DoesNotExist:
            return Response({'error': 'Asset not found'}, status=status.HTTP_404_NOT_FOUND)

        api_key = get_openai_key(request.user)
        alt_text = generate_alt_text(asset, api_key)

        return Response({
            'asset_id': asset.id,
            'alt_text': alt_text,
        })


class ResizeAssetView(APIView):
    """Resize an image for platform-specific dimensions"""
    permission_classes = [IsAuthenticated, IsCreatorOrAbove]

    def post(self, request, asset_id):
        try:
            asset = ImageGeneration.objects.get(id=asset_id, user=request.user)
        except ImageGeneration.DoesNotExist:
            return Response({'error': 'Asset not found'}, status=status.HTTP_404_NOT_FOUND)

        platforms = request.data.get('platforms')
        variants = resize_image_for_platforms(asset, platforms=platforms)

        return Response({
            'asset_id': asset.id,
            'variants_created': len(variants),
            'variants': [
                {
                    'id': v.id,
                    'platform': v.platform,
                    'format_label': v.format_label,
                    'dimensions': v.dimensions,
                    'file_url': v.file_url.url if v.file_url else None,
                }
                for v in variants
            ],
        }, status=status.HTTP_201_CREATED)


class ApplyTemplateView(APIView):
    """Apply a brand template overlay to an image"""
    permission_classes = [IsAuthenticated, IsCreatorOrAbove]

    def post(self, request, asset_id):
        try:
            asset = ImageGeneration.objects.get(id=asset_id, user=request.user)
        except ImageGeneration.DoesNotExist:
            return Response({'error': 'Asset not found'}, status=status.HTTP_404_NOT_FOUND)

        template_id = request.data.get('template_id')
        if not template_id:
            return Response({'error': 'template_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            template = BrandTemplate.objects.get(id=template_id)
        except BrandTemplate.DoesNotExist:
            return Response({'error': 'Template not found'}, status=status.HTTP_404_NOT_FOUND)

        result = apply_brand_template(asset, template)
        if result is None:
            return Response(
                {'error': 'Failed to apply template'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({
            'asset_id': result.id,
            'message': 'Brand template applied successfully',
        })


class AssetVersionsView(APIView):
    """Get version history for an asset"""
    permission_classes = [IsAuthenticated, IsViewerOrAbove]

    def get(self, request, asset_id):
        try:
            asset = ImageGeneration.objects.get(id=asset_id, user=request.user)
        except ImageGeneration.DoesNotExist:
            return Response({'error': 'Asset not found'}, status=status.HTTP_404_NOT_FOUND)

        versions = CreativeVersionHistory.objects.filter(asset=asset).order_by('-created_at')

        return Response([
            {
                'id': v.id,
                'version': v.version,
                'file_url': v.file_url.url if v.file_url else None,
                'generation_params': v.generation_params,
                'created_at': v.created_at.isoformat(),
            }
            for v in versions
        ])


# ============================================================
# Draft-Scoped Asset Endpoints (V1.2.1 Gap 3)
# ============================================================

class DraftAssetsListView(APIView):
    """List all creative assets for a specific draft"""
    permission_classes = [IsAuthenticated, IsViewerOrAbove]

    def get(self, request, post_id):
        try:
            post = Post.objects.get(id=post_id, user=request.user)
        except Post.DoesNotExist:
            return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)

        assets = ImageGeneration.objects.filter(
            post=post, is_current=True
        ).order_by('-created_at')

        result = []
        for a in assets:
            display_img = a.get_display_image()
            img_url = display_img.url if display_img else None
            # Parse size string like "1024x1024" into width/height
            width, height = 1024, 1024
            if a.size and 'x' in a.size:
                parts = a.size.split('x')
                try:
                    width, height = int(parts[0]), int(parts[1])
                except (ValueError, IndexError):
                    pass
            result.append({
                'id': a.id,
                'title': a.title,
                'prompt': a.prompt,
                'style': a.style,
                'size': a.size,
                'status': a.status,
                'version': a.version,
                'alt_text': a.alt_text or '',
                'url': img_url,
                'thumbnail_url': img_url,
                'image_url': img_url,
                'width': width,
                'height': height,
                'file_type': 'image/png',
                'created_at': a.created_at.isoformat(),
            })

        return Response(result)


class DraftAssetGenerateView(APIView):
    """Generate an image asset for a specific draft"""
    permission_classes = [IsAuthenticated, IsCreatorOrAbove]

    MAX_IMAGES_PER_DRAFT = 4

    def post(self, request, post_id):
        try:
            post = Post.objects.get(id=post_id, user=request.user)
        except Post.DoesNotExist:
            return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)

        # Enforce per-draft image limit
        existing_count = ImageGeneration.objects.filter(
            post=post, is_current=True, status='completed',
        ).count()
        if existing_count >= self.MAX_IMAGES_PER_DRAFT:
            return Response(
                {'error': f'Maximum {self.MAX_IMAGES_PER_DRAFT} images per draft reached.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        prompt = request.data.get('prompt', '')
        style = request.data.get('style', 'realistic')
        size = request.data.get('size', '1024x1024')

        if not prompt:
            # Auto-generate prompt from post context
            prompt = f"Social media image for: {(post.caption or post.hook or 'social media post')[:300]}"

        api_key = get_openai_key(request.user)
        if not api_key:
            return Response(
                {'error': 'No OpenAI API key configured.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        asset = ImageGeneration.objects.create(
            user=request.user,
            post=post,
            title=request.data.get('title', f"Asset for draft #{post.id}"),
            prompt=prompt,
            style=style,
            size=size,
            provider='openai',
            status='pending',
        )

        # Trigger generation (async in production, inline here)
        try:
            client = openai.OpenAI(api_key=api_key)
            response = client.images.generate(
                model='dall-e-3',
                prompt=prompt,
                size=size if size in ('1024x1024', '1024x1792', '1792x1024') else '1024x1024',
                quality='standard',
                n=1,
            )
            image_url = response.data[0].url
            asset.revised_prompt = response.data[0].revised_prompt or ''
            asset.status = 'completed'
            # Save URL reference (actual file download would be handled by a service)
            asset.enhanced_prompt = image_url
            asset.save()
        except Exception as e:
            logger.error(f"Draft asset generation failed: {e}")
            asset.status = 'failed'
            asset.error_message = str(e)
            asset.save()
            return Response(
                {'error': f'Image generation failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        post.update_checklist()
        notify_images_ready(post)

        return Response({
            'id': asset.id,
            'post_id': post.id,
            'title': asset.title,
            'status': asset.status,
            'image_url': asset.enhanced_prompt,
            'revised_prompt': asset.revised_prompt,
        }, status=status.HTTP_201_CREATED)


class DraftAssetUploadView(APIView):
    """Upload an asset file for a specific draft"""
    permission_classes = [IsAuthenticated, IsCreatorOrAbove]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, post_id):
        try:
            post = Post.objects.get(id=post_id, user=request.user)
        except Post.DoesNotExist:
            return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)

        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)

        asset = ImageGeneration.objects.create(
            user=request.user,
            post=post,
            title=request.data.get('title', file.name),
            prompt='Uploaded asset',
            style='realistic',
            size='1024x1024',
            provider='openai',
            status='completed',
            generated_image=file,
        )

        post.update_checklist()

        return Response({
            'id': asset.id,
            'post_id': post.id,
            'title': asset.title,
            'image_url': asset.generated_image.url if asset.generated_image else None,
        }, status=status.HTTP_201_CREATED)


class AssetRegenerateView(APIView):
    """Regenerate an asset, saving old version to history"""
    permission_classes = [IsAuthenticated, IsCreatorOrAbove]

    def post(self, request, asset_id):
        try:
            asset = ImageGeneration.objects.get(id=asset_id, user=request.user)
        except ImageGeneration.DoesNotExist:
            return Response({'error': 'Asset not found'}, status=status.HTTP_404_NOT_FOUND)

        # Save current version to history
        CreativeVersionHistory.objects.create(
            asset=asset,
            version=asset.version,
            file_url=asset.generated_image if asset.generated_image else '',
            generation_params={
                'prompt': asset.prompt,
                'style': asset.style,
                'size': asset.size,
                'revised_prompt': asset.revised_prompt or '',
            },
        )

        # Update prompt if provided
        new_prompt = request.data.get('prompt', asset.prompt)
        new_style = request.data.get('style', asset.style)

        api_key = get_openai_key(request.user)
        if not api_key:
            return Response(
                {'error': 'No OpenAI API key configured.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            client = openai.OpenAI(api_key=api_key)
            response = client.images.generate(
                model='dall-e-3',
                prompt=new_prompt,
                size=asset.size if asset.size in ('1024x1024', '1024x1792', '1792x1024') else '1024x1024',
                quality='standard',
                n=1,
            )
            image_url = response.data[0].url

            asset.version += 1
            asset.prompt = new_prompt
            asset.style = new_style
            asset.revised_prompt = response.data[0].revised_prompt or ''
            asset.enhanced_prompt = image_url
            asset.status = 'completed'
            asset.save()
        except Exception as e:
            logger.error(f"Asset regeneration failed: {e}")
            return Response(
                {'error': f'Regeneration failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({
            'id': asset.id,
            'version': asset.version,
            'status': asset.status,
            'image_url': asset.enhanced_prompt,
            'revised_prompt': asset.revised_prompt,
        })


# ============================================================
# Clone Rejected Draft (V1.2.1 Gap 6)
# ============================================================

class CloneDraftView(APIView):
    """Clone a rejected/existing draft into a new draft"""
    permission_classes = [IsAuthenticated, IsCreatorOrAbove]

    def post(self, request, post_id):
        try:
            original = Post.objects.get(id=post_id, user=request.user)
        except Post.DoesNotExist:
            return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)

        # Create new draft copying all fields
        new_post = Post.objects.create(
            user=request.user,
            caption=original.caption,
            ai_generated=original.ai_generated,
            media_files=original.media_files,
            scheduled_time=timezone.now(),
            timezone=original.timezone,
            platforms=original.platforms,
            status='draft',
            brand=original.brand,
            pillar=original.pillar,
            hook=original.hook,
            angle=original.angle,
            format_type=original.format_type,
            cta_text=original.cta_text,
            goal=original.goal,
        )

        # Clone captions
        for cap in PostCaption.objects.filter(post=original):
            PostCaption.objects.create(
                post=new_post,
                platform=cap.platform,
                variant_number=cap.variant_number,
                body=cap.body,
                tone=cap.tone,
                cta_text=cap.cta_text,
                is_selected=cap.is_selected,
            )

        # Clone hashtags
        for ht in PostHashtag.objects.filter(post=original):
            PostHashtag.objects.create(
                post=new_post,
                platform=ht.platform,
                tag=ht.tag,
                tier=ht.tier,
                is_selected=ht.is_selected,
                placement=ht.placement,
            )

        # Clone creative assets
        for asset in ImageGeneration.objects.filter(post=original, is_current=True):
            ImageGeneration.objects.create(
                user=request.user,
                post=new_post,
                title=asset.title,
                prompt=asset.prompt,
                style=asset.style,
                size=asset.size,
                provider=asset.provider,
                status=asset.status,
                generated_image=asset.generated_image,
                alt_text=asset.alt_text,
            )

        new_post.update_checklist()

        return Response({
            'message': 'Draft cloned successfully',
            'original_post_id': original.id,
            'new_post_id': new_post.id,
            'status': new_post.status,
        }, status=status.HTTP_201_CREATED)


# ============================================================
# Carousel Auto-Split (V1.2.1 — Section 4.6)
# ============================================================

class CarouselSplitView(APIView):
    """Auto-split long-form content into carousel slides.

    Takes text content and generates 2-10 slide images.
    Phase 1: LLM-based text splitting + individual image generation per slide.
    """
    permission_classes = [IsAuthenticated, IsCreatorOrAbove]

    MAX_CAROUSEL_SLIDES = 10
    MAX_IMAGES_PER_DRAFT = 4

    def post(self, request, post_id):
        try:
            post = Post.objects.get(id=post_id, user=request.user)
        except Post.DoesNotExist:
            return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)

        # Enforce per-draft limit for carousel too
        existing_count = ImageGeneration.objects.filter(
            post=post, is_current=True, status='completed',
        ).count()
        if existing_count >= self.MAX_IMAGES_PER_DRAFT:
            return Response(
                {'error': f'Maximum {self.MAX_IMAGES_PER_DRAFT} images per draft reached.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        content = request.data.get('content', '')
        if not content:
            content = post.caption or post.hook or ''
        if not content:
            return Response(
                {'error': 'No content provided for carousel split.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        max_slides = min(int(request.data.get('max_slides', 10)), 10)
        style = request.data.get('style', 'minimal')

        api_key = get_openai_key(request.user)
        if not api_key:
            return Response(
                {'error': 'No OpenAI API key configured.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Step 1: Use LLM to split content into slide texts
        try:
            client = openai.OpenAI(api_key=api_key)
            split_response = client.chat.completions.create(
                model='gpt-4o-mini',
                messages=[
                    {
                        'role': 'system',
                        'content': (
                            'You are a carousel content strategist. Split the given text into '
                            f'2-{max_slides} concise carousel slides. Each slide should have a '
                            'headline and body text. Return JSON: '
                            '{"slides": [{"headline": "...", "body": "..."}]}'
                        ),
                    },
                    {'role': 'user', 'content': content[:3000]},
                ],
                temperature=0.7,
                max_tokens=2000,
                response_format={'type': 'json_object'},
            )
            slides_data = json.loads(split_response.choices[0].message.content)
            slides = slides_data.get('slides', [])[:max_slides]
        except Exception as e:
            logger.error(f"Carousel split LLM failed: {e}")
            return Response(
                {'error': f'Failed to split content: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        if len(slides) < 2:
            return Response(
                {'error': 'Content too short for carousel (need at least 2 slides).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Step 2: Generate image for each slide
        created_assets = []
        for i, slide in enumerate(slides):
            slide_prompt = (
                f"Carousel slide {i + 1}/{len(slides)}: "
                f"{slide.get('headline', '')} — {slide.get('body', '')[:200]}"
            )

            asset = ImageGeneration.objects.create(
                user=request.user,
                post=post,
                title=f"Carousel Slide {i + 1}",
                prompt=slide_prompt,
                style=style,
                size='1024x1024',
                provider='openai',
                status='pending',
            )

            try:
                response = client.images.generate(
                    model='dall-e-3',
                    prompt=f"Clean {style} carousel slide design: {slide_prompt}",
                    size='1024x1024',
                    quality='standard',
                    n=1,
                )
                asset.enhanced_prompt = response.data[0].url
                asset.revised_prompt = response.data[0].revised_prompt or ''
                asset.status = 'completed'
                asset.save()
            except Exception as e:
                logger.error(f"Carousel slide {i + 1} generation failed: {e}")
                asset.status = 'failed'
                asset.error_message = str(e)
                asset.save()

            created_assets.append({
                'id': asset.id,
                'slide_number': i + 1,
                'headline': slide.get('headline', ''),
                'body': slide.get('body', ''),
                'status': asset.status,
                'image_url': asset.enhanced_prompt if asset.status == 'completed' else None,
            })

        post.update_checklist()
        notify_images_ready(post)

        return Response({
            'post_id': post.id,
            'total_slides': len(slides),
            'slides': created_assets,
        }, status=status.HTTP_201_CREATED)
