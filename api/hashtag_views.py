from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsCreatorOrAbove, IsWorkspaceAdmin, IsViewerOrAbove

from posts.models import Post, PostHashtag, HashtagGroup, BannedHashtag
from brands.models import Brand
from accounts.api_keys import get_openai_key
from accounts.services.notification_service import notify_daily_limit_warning
from posts.services.hashtag_service import generate_hashtags
from .serializers import (
    PostHashtagSerializer, HashtagGroupSerializer, BannedHashtagSerializer,
    GenerateHashtagsRequestSerializer,
)


class DraftHashtagsView(APIView):
    """List hashtags for a specific draft/post"""
    permission_classes = [IsAuthenticated, IsViewerOrAbove]

    def get(self, request, post_id):
        try:
            post = Post.objects.get(id=post_id, user=request.user)
        except Post.DoesNotExist:
            return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)

        hashtags = post.hashtags.all()
        serializer = PostHashtagSerializer(hashtags, many=True)
        return Response(serializer.data)


class GenerateHashtagsView(APIView):
    """Generate hashtags for a draft using LLM + tier logic"""
    permission_classes = [IsAuthenticated, IsCreatorOrAbove]

    def post(self, request, post_id):
        try:
            post = Post.objects.get(id=post_id, user=request.user)
        except Post.DoesNotExist:
            return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = GenerateHashtagsRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        platform = data['platform']
        count = data.get('count', 20)
        topic = data.get('topic', '')

        # Get platform defaults
        defaults = PostHashtag.PLATFORM_DEFAULTS.get(platform, {'default': 10, 'max': 20})
        count = min(count, defaults['max'])

        # V1.2.1 — Rate limit check
        if post.brand and post.brand.workspace:
            ws = post.brand.workspace
            if not ws.can_generate():
                return Response(
                    {'error': 'Daily generation limit reached. Try again tomorrow.'},
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )

        # Get API key and call the real hashtag service
        api_key = get_openai_key(request.user)
        created = generate_hashtags(
            post=post,
            platform=platform,
            api_key=api_key,
            count=count,
            topic=topic,
        )

        # V1.2.1 — Increment generation count
        if post.brand and post.brand.workspace:
            post.brand.workspace.increment_generation(len(created))

        # V1.2.1 — Daily limit warning
        if post.brand and post.brand.workspace:
            ws = post.brand.workspace
            if ws.max_generations_per_day and ws.generations_today:
                usage_pct = int((ws.generations_today / ws.max_generations_per_day) * 100)
                if usage_pct >= 80:
                    notify_daily_limit_warning(request.user, usage_pct)

        result = PostHashtagSerializer(created, many=True)
        return Response(result.data, status=status.HTTP_201_CREATED)


class ToggleHashtagView(APIView):
    """Toggle or update a hashtag"""
    permission_classes = [IsAuthenticated, IsCreatorOrAbove]

    def patch(self, request, hashtag_id):
        try:
            hashtag = PostHashtag.objects.get(
                id=hashtag_id, post__user=request.user
            )
        except PostHashtag.DoesNotExist:
            return Response({'error': 'Hashtag not found'}, status=status.HTTP_404_NOT_FOUND)

        if 'is_selected' in request.data:
            hashtag.is_selected = request.data['is_selected']
        if 'placement' in request.data:
            hashtag.placement = request.data['placement']
        hashtag.save()
        hashtag.post.update_checklist()

        return Response(PostHashtagSerializer(hashtag).data)


class HashtagGroupViewSet(viewsets.ModelViewSet):
    serializer_class = HashtagGroupSerializer
    permission_classes = [IsAuthenticated, IsCreatorOrAbove]

    def get_queryset(self):
        brand_id = self.request.query_params.get('brand_id')
        qs = HashtagGroup.objects.filter(brand__workspace__owner=self.request.user)
        if brand_id:
            qs = qs.filter(brand_id=brand_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class BannedHashtagViewSet(viewsets.ModelViewSet):
    serializer_class = BannedHashtagSerializer
    permission_classes = [IsAuthenticated, IsWorkspaceAdmin]

    def get_queryset(self):
        brand_id = self.request.query_params.get('brand_id')
        qs = BannedHashtag.objects.filter(brand__workspace__owner=self.request.user)
        if brand_id:
            qs = qs.filter(brand_id=brand_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(added_by=self.request.user)
