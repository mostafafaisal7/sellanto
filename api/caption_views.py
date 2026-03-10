import json
import logging

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import viewsets

from accounts.permissions import IsCreatorOrAbove, IsViewerOrAbove
from accounts.services.diamond_service import pre_check, deduct_diamonds

from posts.models import Post, PostCaption
from accounts.services.llm_service import get_llm_service
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

        service = get_llm_service(request.user)

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

        original_text = (post.caption or post.hook or 'No caption provided')[:500]
        override_prompt = request.data.get('override_prompt', '')
        think_harder = request.data.get('think_harder', False)

        prompt = f"""<context>
You are generating caption variants for a social media draft post. Each variant must also include a DALL-E 3 image prompt that visually complements the caption.

Brand context: {brand_context}{pillar_context}
Original text: {original_text}
{f'Hook/angle: {post.hook}' if post.hook else ''}
{f'Goal: {post.goal}' if post.goal else ''}
Requested tone: {tone}
Include CTA: {include_cta}
</context>

<instructions>
Think step by step:

1. ANALYZE the original text and brand context to identify the core message, target audience, and emotional angle.
2. PLAN {count} distinctly different approaches. For each variant, choose a DIFFERENT combination from these dimensions:
   - Hook type: question | bold claim | statistic | micro-story | curiosity gap | pattern interrupt
   - Structure: linear narrative | problem-solve | listicle | testimonial-style | before-after | open loop
   - Persuasion lever: social proof | urgency | aspiration | empathy | authority | FOMO
3. WRITE each caption variant ensuring:
   a. The opening line (first 125 characters) is a scroll-stopper — this is the most critical part. It must earn the reader's next second.
   b. Tone matches "{tone}" throughout.
   c. Content is platform-appropriate and uses natural, human language.
   d. No AI-sounding phrases: avoid "In today's world," "Unlock your potential," "Game-changer," "Dive in," "Elevate," "Leverage," "Seamlessly."
4. If {include_cta} is true, embed a clear, specific call-to-action that tells the reader exactly what to do next.
5. For each caption, generate a DALL-E 3 image prompt that:
   - Describes the subject, setting, composition, and mood in vivid detail
   - Specifies an art style (photography, illustration, flat design, etc.)
   - Includes lighting direction (golden hour, studio, dramatic, soft)
   - Mentions camera angle or framing (close-up, wide, overhead, eye-level)
   - Stays under 80 words
</instructions>

<output_format>
Return ONLY this JSON structure — no additional text:
{{
  "captions": [
    {{
      "body": "<full caption text>",
      "cta_text": "<call-to-action text or empty string>",
      "image_prompt": "<detailed DALL-E 3 image prompt>"
    }}
  ]
}}
</output_format>

<constraints>
- Each variant MUST use a different hook type and persuasion lever — not just synonym swaps or structural rearrangements.
- Do NOT start two captions with the same word or sentence structure.
- Do NOT use hashtags unless explicitly part of the instructions.
- Image prompts must be specific enough to produce a unique, high-quality visual.
- Return valid JSON only. No markdown fences, no explanation.
</constraints>

<example>
Input: Brand sells eco-friendly water bottles. Tone: casual. Count: 2. CTA: true.

Output:
{{
  "captions": [
    {{
      "body": "Your plastic bottle is judging you. \\n\\nEvery single-use bottle takes 450 years to decompose. Four hundred and fifty. Meanwhile, our bamboo bottles break down in 3 months — and they look way better on your desk.\\n\\nMake the switch that actually matters.",
      "cta_text": "Tap the link in bio to grab yours before they sell out",
      "image_prompt": "Flat lay photograph of a sleek bamboo water bottle surrounded by scattered single-use plastic bottles on a crumpled white backdrop. Natural daylight from the left. The bamboo bottle is centered and in sharp focus while plastic bottles are slightly blurred. Clean, minimalist composition. Editorial product photography style. Muted earth tones with a pop of green."
    }},
    {{
      "body": "I stopped buying plastic water bottles 6 months ago.\\n\\nHere's what changed: I saved $340, kept 180 bottles out of landfills, and honestly? My water tastes better.\\n\\nThe small swaps are the ones that stick.",
      "cta_text": "Start your swap today — link in bio",
      "image_prompt": "Close-up lifestyle photograph of a person's hand holding a matte green bamboo water bottle on a sunlit hiking trail. Shallow depth of field with golden hour backlighting creating a warm rim light. Bokeh forest background. Warm, aspirational mood. Shot on 85mm lens, natural photography style."
    }}
  ]
}}
</example>"""

        if override_prompt:
            prompt = override_prompt

        # Diamond Token pre-check
        can_afford, cost, balance = pre_check(request.user, 'caption')
        if not can_afford:
            return Response({
                'error': 'Insufficient Diamond Tokens',
                'diamond_cost': cost,
                'diamond_balance': balance,
                'code': 'INSUFFICIENT_DIAMONDS',
            }, status=402)

        try:
            llm_result = service.chat_completion(
                messages=[
                    {"role": "system", "content": "You are a world-class social media copywriter and brand strategist specializing in high-engagement, conversion-focused content.\n\nYour task is to generate high-quality social media caption variants that feel authentic, strategic, emotionally engaging, and platform-optimized.\n\nYou understand:\n- Audience psychology and scroll-stopping behavior patterns\n- Hook frameworks: question hooks, bold-claim hooks, statistic hooks, story hooks, curiosity-gap hooks, and pattern-interrupt hooks\n- Storytelling frameworks: AIDA (Attention-Interest-Desire-Action), PAS (Problem-Agitate-Solve), BAB (Before-After-Bridge), and open loops\n- Persuasion principles: social proof, urgency, scarcity, reciprocity, authority, and emotional triggers (curiosity, FOMO, aspiration, empathy)\n- Modern social media best practices across all major platforms\n- Brand voice consistency and platform-native writing conventions\n\nYou also generate professional, detailed, and visually descriptive image prompts optimized for DALL-E 3 — specifying subject, composition, lighting, style, mood, color palette, and camera angle for maximum visual impact.\n\nCRITICAL OUTPUT RULES:\n- Return ONLY valid JSON — no markdown, no commentary, no wrapping\n- Follow the JSON schema exactly\n- Ensure captions are natural and human-like\n- Avoid generic or repetitive phrasing\n- Each variant must be clearly different in hook, angle, structure, and persuasion style"},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.8,
                max_tokens=4000 if think_harder else 2000,
                response_format={"type": "json_object"},
                thinking_budget=10000 if think_harder else 0,
            )
            if not llm_result.success:
                return Response(
                    {'error': llm_result.error or 'No AI API key configured. Go to Settings to add your OpenAI or Gemini key.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            deduct_diamonds(user=request.user, feature='caption', provider='claude', raw_tokens=llm_result.tokens_used if hasattr(llm_result, 'tokens_used') else 0)

            result = json.loads(llm_result.content)
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
                    image_prompt=cap_data.get('image_prompt', ''),
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
            'used_prompt': prompt,
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

        brand = post.brand
        override_prompt = request.data.get('override_prompt', '')
        think_harder = request.data.get('think_harder', False)

        # Diamond Token pre-check
        can_afford, cost, balance = pre_check(request.user, 'caption_adapt')
        if not can_afford:
            return Response({
                'error': 'Insufficient Diamond Tokens',
                'diamond_cost': cost,
                'diamond_balance': balance,
                'code': 'INSUFFICIENT_DIAMONDS',
            }, status=402)

        adapted = []
        all_used_prompts = []
        for platform in data['target_platforms']:
            adapted_caption, used_prompt = adapt_caption(source, platform, brand=brand, override_prompt=override_prompt or None, user=request.user, think_harder=think_harder)
            adapted.append(adapted_caption)
            all_used_prompts.append(used_prompt)

        deduct_diamonds(user=request.user, feature='caption_adapt', provider='claude', raw_tokens=0)

        post.update_checklist()
        result = PostCaptionSerializer(adapted, many=True)
        return Response({
            'captions': result.data,
            'used_prompt': all_used_prompts[0] if all_used_prompts else '',
        }, status=status.HTTP_201_CREATED)


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
