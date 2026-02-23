import json
import logging

import openai
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import viewsets

from accounts.permissions import IsCreatorOrAbove, IsViewerOrAbove

from posts.models import Post, PostCaption
from accounts.api_keys import get_openai_key
from ai_caption.services.adaptation_service import adapt_caption
from ai_caption.services.compliance_service import check_compliance
from accounts.services.notification_service import notify_captions_ready, notify_daily_limit_warning
from .serializers import (
    PostCaptionSerializer, GenerateCaptionsRequestSerializer,
    AdaptCaptionRequestSerializer,
)

logger = logging.getLogger(__name__)


class PostCaptionViewSet(viewsets.ModelViewSet):
    serializer_class = PostCaptionSerializer
    permission_classes = [IsAuthenticated, IsCreatorOrAbove]

    def get_queryset(self):
        return PostCaption.objects.filter(post__user=self.request.user)

    @property
    def _post_queryset(self):
        return Post.objects.filter(user=self.request.user)


class DraftCaptionsView(APIView):
    """List captions for a specific draft/post"""
    permission_classes = [IsAuthenticated, IsViewerOrAbove]

    def get(self, request, post_id):
        try:
            post = Post.objects.get(id=post_id, user=request.user)
        except Post.DoesNotExist:
            return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)

        captions = post.captions.all()
        serializer = PostCaptionSerializer(captions, many=True)
        return Response(serializer.data)


class GenerateCaptionsView(APIView):
    """Generate caption variants for a draft using LLM"""
    permission_classes = [IsAuthenticated, IsCreatorOrAbove]

    def post(self, request, post_id):
        try:
            post = Post.objects.get(id=post_id, user=request.user)
        except Post.DoesNotExist:
            return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = GenerateCaptionsRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        platforms = data.get('platforms', ['all'])
        count = data.get('count', 3)
        tone = data.get('tone', 'professional')
        include_cta = data.get('include_cta', False)

        api_key = get_openai_key(request.user)
        if not api_key:
            return Response(
                {'error': 'No OpenAI API key configured. Please add one in Settings.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # V1.2.1 — Rate limit check
        if post.brand and post.brand.workspace:
            ws = post.brand.workspace
            if not ws.can_generate():
                return Response(
                    {'error': 'Daily generation limit reached. Try again tomorrow.'},
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )

        # Build context for LLM
        brand_context = ''
        if post.brand:
            brand_context = f"Brand: {post.brand.brand_name}"
            if post.brand.industry:
                brand_context += f", Industry: {post.brand.industry}"
            if post.brand.voice_tone:
                brand_context += f", Voice: {post.brand.voice_tone}"
        pillar_context = f", Content Pillar: {post.pillar.name}" if post.pillar else ''

        prompt = f"""Generate {count} unique social media caption variants.

Context:
{brand_context}{pillar_context}
Original text: {(post.caption or post.hook or 'No caption provided')[:500]}
{f'Hook/angle: {post.hook}' if post.hook else ''}
{f'Goal: {post.goal}' if post.goal else ''}
Tone: {tone}
{'Include a clear call-to-action in each variant.' if include_cta else ''}

Rules:
- Each variant must be meaningfully different (different hook, structure, or angle)
- Match the requested tone
- Make them engaging and platform-appropriate

Return JSON:
{{"captions": [{{"body": "...", "cta_text": "..."}}]}}
"""

        try:
            client = openai.OpenAI(api_key=api_key)
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an expert social media copywriter. Return only valid JSON."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.8,
                max_tokens=2000,
                response_format={"type": "json_object"},
            )
            result = json.loads(response.choices[0].message.content)
            generated = result.get('captions', [])
        except Exception as e:
            logger.error(f"Caption generation failed: {e}")
            return Response(
                {'error': f'Caption generation failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        captions_created = []
        for i, cap_data in enumerate(generated):
            for platform in platforms:
                caption = PostCaption.objects.create(
                    post=post,
                    platform=platform,
                    variant_number=i + 1,
                    body=cap_data.get('body', ''),
                    tone=tone,
                    cta_text=cap_data.get('cta_text', ''),
                    is_selected=(i == 0 and platform == platforms[0]),
                )
                captions_created.append(caption)

        # V1.2.1 — Increment generation count
        if post.brand and post.brand.workspace:
            post.brand.workspace.increment_generation(len(captions_created))

        # V1.2.1 — Daily limit warning
        if post.brand and post.brand.workspace:
            ws = post.brand.workspace
            if ws.max_generations_per_day and ws.generations_today:
                usage_pct = int((ws.generations_today / ws.max_generations_per_day) * 100)
                if usage_pct >= 80:
                    notify_daily_limit_warning(request.user, usage_pct)

        # V1.2.1 — Compliance check
        compliance_warnings = []
        if post.brand:
            for cap in captions_created:
                result_check = check_compliance(cap.body, post.brand)
                if not result_check['is_compliant']:
                    compliance_warnings.append({
                        'caption_id': cap.id,
                        'violations': result_check['violations'],
                    })

        post.update_checklist()
        notify_captions_ready(post)
        result = PostCaptionSerializer(captions_created, many=True)
        response_data = {
            'captions': result.data,
        }
        if compliance_warnings:
            response_data['compliance_warnings'] = compliance_warnings
        return Response(response_data, status=status.HTTP_201_CREATED)


class AdaptCaptionView(APIView):
    """Adapt an existing caption to different platforms"""
    permission_classes = [IsAuthenticated, IsCreatorOrAbove]

    def post(self, request, post_id):
        try:
            post = Post.objects.get(id=post_id, user=request.user)
        except Post.DoesNotExist:
            return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = AdaptCaptionRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            source = PostCaption.objects.get(
                id=data['caption_id'], post=post
            )
        except PostCaption.DoesNotExist:
            return Response({'error': 'Source caption not found'}, status=status.HTTP_404_NOT_FOUND)

        api_key = get_openai_key(request.user)
        brand = post.brand

        adapted = []
        for platform in data['target_platforms']:
            adapted_caption = adapt_caption(source, platform, api_key, brand=brand)
            adapted.append(adapted_caption)

        post.update_checklist()
        result = PostCaptionSerializer(adapted, many=True)
        return Response(result.data, status=status.HTTP_201_CREATED)


class SelectCaptionView(APIView):
    """Select a caption as the primary for its platform"""
    permission_classes = [IsAuthenticated, IsCreatorOrAbove]

    def patch(self, request, caption_id):
        try:
            caption = PostCaption.objects.get(
                id=caption_id, post__user=request.user
            )
        except PostCaption.DoesNotExist:
            return Response({'error': 'Caption not found'}, status=status.HTTP_404_NOT_FOUND)

        # Deselect others for same platform
        PostCaption.objects.filter(
            post=caption.post, platform=caption.platform
        ).update(is_selected=False)

        caption.is_selected = True
        caption.save()
        caption.post.update_checklist()

        return Response(PostCaptionSerializer(caption).data)


class CaptionPreviewView(APIView):
    """Preview a caption formatted for a specific platform"""
    permission_classes = [IsAuthenticated, IsViewerOrAbove]

    def get(self, request, caption_id, platform):
        try:
            caption = PostCaption.objects.get(
                id=caption_id, post__user=request.user
            )
        except PostCaption.DoesNotExist:
            return Response({'error': 'Caption not found'}, status=status.HTTP_404_NOT_FOUND)

        # Platform-specific formatting
        char_limits = {
            'twitter': 280,
            'linkedin': 3000,
            'facebook': 63206,
            'instagram': 2200,
        }

        body = caption.body or ''
        limit = char_limits.get(platform, 5000)
        truncated = len(body) > limit
        preview_text = body[:limit]

        # Get hashtags for this platform
        from posts.models import PostHashtag
        hashtags = PostHashtag.objects.filter(
            post=caption.post, platform=platform, is_selected=True
        )
        hashtag_text = ' '.join(f'#{h.tag}' for h in hashtags)

        return Response({
            'caption_id': caption.id,
            'platform': platform,
            'body': preview_text,
            'hashtags': hashtag_text,
            'cta_text': caption.cta_text,
            'char_count': len(body),
            'char_limit': limit,
            'truncated': truncated,
            'full_preview': f"{preview_text}\n\n{hashtag_text}".strip() if hashtag_text else preview_text,
        })


class ABTagCaptionView(APIView):
    """Tag a caption for A/B testing"""
    permission_classes = [IsAuthenticated, IsCreatorOrAbove]

    def patch(self, request, caption_id):
        try:
            caption = PostCaption.objects.get(
                id=caption_id, post__user=request.user
            )
        except PostCaption.DoesNotExist:
            return Response({'error': 'Caption not found'}, status=status.HTTP_404_NOT_FOUND)

        ab_label = request.data.get('ab_label', 'A')
        if ab_label not in ('A', 'B'):
            return Response({'error': 'ab_label must be A or B'}, status=status.HTTP_400_BAD_REQUEST)

        caption.is_ab_test = True
        caption.ab_label = ab_label
        caption.save()

        return Response(PostCaptionSerializer(caption).data)
