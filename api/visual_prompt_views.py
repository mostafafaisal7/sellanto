"""Visual prompt builder endpoints.

Two thin views that wrap `posts.services.visual_prompt_builder`. They are
called by the Magic Mode pipeline to enrich the raw prompt string sent to
Imagen / Veo with full brand + caption + idea + trending context — so the
generated image or video actually reinforces the post's message instead
of drifting away from it.

Not gated on Diamond Tokens; the small LLM cost is absorbed into the
already-paid image/video generation features.
"""

from __future__ import annotations

from django.db.models import Q
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from brands.models import Brand
from posts.services.visual_prompt_builder import (
    ImageVisualPromptBuilder,
    VideoVisualPromptBuilder,
)


def _truthy(value) -> bool:
    """Parse loose truthy values from JSON or form data."""
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).strip().lower() in ('true', '1', 'yes', 'on')


def _resolve_brand(user, brand_id):
    """Return the Brand if owned (directly or via workspace), else None."""
    if not brand_id:
        return None
    try:
        bid = int(brand_id)
    except (TypeError, ValueError):
        return None
    try:
        return Brand.objects.get(
            Q(user=user) | Q(workspace__owner=user),
            id=bid,
        )
    except Brand.DoesNotExist:
        return None


class BuildImageVisualPromptView(APIView):
    """Synthesise a rich image-generation prompt from full magic context.

    Expected payload:
    {
      "brand_id":   <int>,
      "idea":       {"title": str, "hook"?: str, "angle"?: str, "platform"?: str},
      "caption":    str,
      "platform":   str,
      "color_choices":    [str, ...],
      "trending_topics":  [str, ...],
      "image_style_hint": str,
      "with_copy":        bool,     // forwarded as future context (not used yet)
      "copy_text":        str,
      "product_context":  {"product_type": str, "features": str, "background_style": str} | null
    }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        d = request.data
        brand = _resolve_brand(request.user, d.get('brand_id'))
        if brand is None:
            return Response({'error': 'Brand not found'}, status=status.HTTP_404_NOT_FOUND)

        idea = d.get('idea') or {}
        caption = (d.get('caption') or '').strip()
        platform = (d.get('platform') or 'instagram').strip().lower()
        color_choices = d.get('color_choices') or []
        trending_topics = d.get('trending_topics') or []
        image_style_hint = (d.get('image_style_hint') or '').strip()
        product_context = d.get('product_context') or None
        with_copy = _truthy(d.get('with_copy', False))
        copy_text = (d.get('copy_text') or '').strip()

        # Fallback: today's hand-stitched template (the one the magic pipeline
        # was using before this endpoint existed). Guarantees the caller
        # always gets a usable string even if the LLM is unavailable.
        color_hint = (
            f' Use the following brand color palette in the visual design: '
            f'{", ".join(str(c) for c in color_choices if c)}.'
            if color_choices else ''
        )
        if product_context:
            fallback = (
                f"Professional empty {product_context.get('background_style') or 'clean'} "
                f"photography studio background for a social media post about "
                f"\"{idea.get('title') or ''}\". Visual style: {image_style_hint}.{color_hint} "
                f"IMPORTANT: The centre must be empty as a product will be placed there."
            )
        else:
            fallback = (
                f"Create a professional social media image for: "
                f"\"{idea.get('title') or ''}\". {image_style_hint}{color_hint}"
            )
        # Mirror the user's text-overlay intent into the fallback so the
        # no-LLM path also gives the downstream image endpoint a clear signal.
        if with_copy and copy_text:
            fallback += f' The image must prominently feature the text "{copy_text}".'
        elif not with_copy:
            fallback += ' The image must contain no text, letters, or typography.'

        rich = ImageVisualPromptBuilder.build(
            user=request.user,
            brand=brand,
            idea=idea,
            caption=caption,
            platform=platform,
            color_choices=color_choices,
            trending_topics=trending_topics,
            image_style_hint=image_style_hint,
            product_context=product_context,
            with_copy=with_copy,
            copy_text=copy_text if with_copy else '',
            fallback=fallback,
        )
        return Response({'prompt': rich})


class BuildVideoVisualPromptView(APIView):
    """Synthesise a rich video-generation prompt from magic context.

    Expected payload:
    {
      "brand_id":     <int>,
      "user_prompt":  str,    // the seed prompt the user typed
      "idea":         {"title"?: str, "hook"?: str, "angle"?: str} | null,
      "trending_topics":     [str, ...],
      "has_reference_image": bool
    }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        d = request.data
        brand = _resolve_brand(request.user, d.get('brand_id'))
        if brand is None:
            return Response({'error': 'Brand not found'}, status=status.HTTP_404_NOT_FOUND)

        user_prompt = (d.get('user_prompt') or '').strip()
        idea = d.get('idea') or None
        trending_topics = d.get('trending_topics') or []
        has_reference_image = bool(d.get('has_reference_image'))

        # Fallback mirrors what VideoWorkingScreen builds today.
        if has_reference_image:
            base = (
                f"Professional empty photography studio background for: {user_prompt}. "
                f"IMPORTANT: Keep the centre of the video completely empty as a "
                f"product will be placed there. Do NOT generate the product itself."
            )
        else:
            base = user_prompt
        hint = ''
        if idea:
            hint = (idea.get('hook') or idea.get('angle') or idea.get('title') or '').strip()
        fallback = f"{base} — Creative direction: {hint}" if hint else base

        rich = VideoVisualPromptBuilder.build(
            user=request.user,
            brand=brand,
            user_prompt=user_prompt,
            idea=idea,
            trending_topics=trending_topics,
            has_reference_image=has_reference_image,
            fallback=fallback,
        )
        return Response({'prompt': rich})
