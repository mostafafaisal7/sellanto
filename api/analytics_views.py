import json
import logging

import openai
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Avg, Sum, Count, Q
from django.utils import timezone
from datetime import timedelta

from accounts.permissions import IsCreatorOrAbove, IsWorkspaceAdmin, IsViewerOrAbove

from posts.models import Post
from analytics.models import PostAnalytics, PostComment, LearningSignal, RepurposedContent
from brands.models import Brand, WeeklyReport
from accounts.api_keys import get_openai_key
from .serializers import (
    PostAnalyticsSerializer, PostCommentSerializer, ReplyToCommentSerializer,
    LearningSignalSerializer, RepurposedContentSerializer,
    RepurposeRequestSerializer, WeeklyReportDetailSerializer,
)


class PostQuickStatsView(APIView):
    """Get quick stats for a specific post (24h/48h snapshots)"""
    permission_classes = [IsAuthenticated, IsViewerOrAbove]

    def get(self, request, post_id):
        try:
            post = Post.objects.get(id=post_id, user=request.user)
        except Post.DoesNotExist:
            return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)

        analytics = PostAnalytics.objects.filter(post=post).order_by('-fetched_at')
        snapshot_type = request.query_params.get('snapshot', '')
        if snapshot_type:
            analytics = analytics.filter(snapshot_type=snapshot_type)

        serializer = PostAnalyticsSerializer(analytics, many=True)
        return Response(serializer.data)


class PostCommentsView(APIView):
    """Get comments for a specific post"""
    permission_classes = [IsAuthenticated, IsCreatorOrAbove]

    def get(self, request, post_id):
        try:
            post = Post.objects.get(id=post_id, user=request.user)
        except Post.DoesNotExist:
            return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)

        comments = PostComment.objects.filter(post=post)
        sentiment = request.query_params.get('sentiment')
        if sentiment:
            comments = comments.filter(sentiment=sentiment)

        serializer = PostCommentSerializer(comments, many=True)
        return Response(serializer.data)


class ReplyToCommentView(APIView):
    """Reply to a comment (human reply)"""
    permission_classes = [IsAuthenticated, IsCreatorOrAbove]

    def post(self, request, comment_id):
        try:
            comment = PostComment.objects.get(
                id=comment_id, post__user=request.user
            )
        except PostComment.DoesNotExist:
            return Response({'error': 'Comment not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = ReplyToCommentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        comment.reply_body = serializer.validated_data['reply_body']
        comment.reply_type = serializer.validated_data.get('reply_type', 'human')
        comment.replied = True
        comment.replied_at = timezone.now()
        comment.save()

        return Response(PostCommentSerializer(comment).data)


class AIReplyToCommentView(APIView):
    """Generate and post an AI reply to a comment"""
    permission_classes = [IsAuthenticated, IsCreatorOrAbove]

    def post(self, request, comment_id):
        try:
            comment = PostComment.objects.get(
                id=comment_id, post__user=request.user
            )
        except PostComment.DoesNotExist:
            return Response({'error': 'Comment not found'}, status=status.HTTP_404_NOT_FOUND)

        api_key = get_openai_key(request.user)
        if not api_key:
            return Response(
                {'error': 'No OpenAI API key configured.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Build context
        post = comment.post
        brand_voice = ''
        if post.brand and post.brand.voice_tone:
            brand_voice = f"Brand voice: {post.brand.voice_tone}"

        prompt = f"""Generate a brief, friendly reply to this social media comment.

Comment: "{comment.body}"
Author: {comment.author_name or 'Someone'}
Post caption: {(post.caption or '')[:300]}
{brand_voice}

Rules:
- Keep it concise (1-3 sentences)
- Be warm and engaging
- Match the brand voice if provided
- Don't be generic — reference the comment content

Return only the reply text, nothing else."""

        try:
            client = openai.OpenAI(api_key=api_key)
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a social media community manager."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.7,
                max_tokens=200,
            )
            ai_reply = response.choices[0].message.content.strip().strip('"')
        except Exception as e:
            ai_reply = "Thank you for your comment! We appreciate your feedback."

        comment.reply_body = ai_reply
        comment.reply_type = 'ai'
        comment.replied = True
        comment.replied_at = timezone.now()
        comment.save()

        return Response(PostCommentSerializer(comment).data)


class WeeklyReportView(APIView):
    permission_classes = [IsAuthenticated, IsWorkspaceAdmin]

    def get(self, request, brand_id):
        try:
            brand = Brand.objects.get(id=brand_id, workspace__owner=request.user)
        except Brand.DoesNotExist:
            return Response({'error': 'Brand not found'}, status=status.HTTP_404_NOT_FOUND)

        reports = WeeklyReport.objects.filter(brand=brand).order_by('-period_end')[:10]
        serializer = WeeklyReportDetailSerializer(reports, many=True)
        return Response(serializer.data)


class AnalyticsDashboardView(APIView):
    """Aggregated analytics dashboard for a brand"""
    permission_classes = [IsAuthenticated, IsViewerOrAbove]

    def get(self, request, brand_id):
        try:
            brand = Brand.objects.get(id=brand_id, workspace__owner=request.user)
        except Brand.DoesNotExist:
            return Response({'error': 'Brand not found'}, status=status.HTTP_404_NOT_FOUND)

        period = request.query_params.get('period', '7d')
        days = {'7d': 7, '14d': 14, '30d': 30, '90d': 90}.get(period, 7)
        since = timezone.now() - timedelta(days=days)

        posts = Post.objects.filter(brand=brand, posted_at__gte=since)
        total_posts = posts.count()

        # Aggregate latest analytics
        analytics = PostAnalytics.objects.filter(
            post__brand=brand, fetched_at__gte=since
        )

        agg = analytics.aggregate(
            total_impressions=Sum('impressions'),
            total_reach=Sum('reach'),
            total_likes=Sum('likes'),
            total_comments=Sum('comments_count'),
            total_shares=Sum('shares'),
            total_clicks=Sum('clicks'),
            avg_engagement=Avg('engagement_rate'),
        )

        return Response({
            'brand_id': brand.id,
            'period': period,
            'total_posts': total_posts,
            'total_impressions': agg['total_impressions'] or 0,
            'total_reach': agg['total_reach'] or 0,
            'total_likes': agg['total_likes'] or 0,
            'total_comments': agg['total_comments'] or 0,
            'total_shares': agg['total_shares'] or 0,
            'total_clicks': agg['total_clicks'] or 0,
            'avg_engagement_rate': round(agg['avg_engagement'] or 0, 2),
        })


class ABTestResultsView(APIView):
    """Get A/B test results for a brand"""
    permission_classes = [IsAuthenticated, IsViewerOrAbove]

    def get(self, request, brand_id):
        try:
            brand = Brand.objects.get(id=brand_id, workspace__owner=request.user)
        except Brand.DoesNotExist:
            return Response({'error': 'Brand not found'}, status=status.HTTP_404_NOT_FOUND)

        from posts.models import PostCaption
        ab_captions = PostCaption.objects.filter(
            post__brand=brand, is_ab_test=True
        ).select_related('post')

        results = []
        post_ids = set(ab_captions.values_list('post_id', flat=True))

        for post_id in post_ids:
            variants = ab_captions.filter(post_id=post_id)
            post_analytics = PostAnalytics.objects.filter(post_id=post_id)

            variant_data = []
            for v in variants:
                analytics = post_analytics.filter(
                    platform=v.platform
                ).order_by('-fetched_at').first()

                variant_data.append({
                    'caption_id': v.id,
                    'ab_label': v.ab_label,
                    'platform': v.platform,
                    'body_preview': v.body[:100],
                    'engagement_rate': analytics.engagement_rate if analytics else 0,
                    'impressions': analytics.impressions if analytics else 0,
                })

            results.append({
                'post_id': post_id,
                'variants': variant_data,
            })

        return Response(results)


class LearningSignalsView(APIView):
    permission_classes = [IsAuthenticated, IsWorkspaceAdmin]

    def get(self, request, brand_id):
        try:
            brand = Brand.objects.get(id=brand_id, workspace__owner=request.user)
        except Brand.DoesNotExist:
            return Response({'error': 'Brand not found'}, status=status.HTTP_404_NOT_FOUND)

        signals = LearningSignal.objects.filter(brand=brand)
        applied = request.query_params.get('applied')
        if applied is not None:
            signals = signals.filter(applied=applied.lower() == 'true')

        serializer = LearningSignalSerializer(signals[:50], many=True)
        return Response(serializer.data)


class WinnerPostsView(APIView):
    """Get top performing posts for a brand"""
    permission_classes = [IsAuthenticated, IsViewerOrAbove]

    def get(self, request, brand_id):
        try:
            brand = Brand.objects.get(id=brand_id, workspace__owner=request.user)
        except Brand.DoesNotExist:
            return Response({'error': 'Brand not found'}, status=status.HTTP_404_NOT_FOUND)

        limit = int(request.query_params.get('limit', 10))

        # Get posts with highest engagement
        top_analytics = PostAnalytics.objects.filter(
            post__brand=brand
        ).order_by('-engagement_rate')[:limit]

        results = []
        for a in top_analytics:
            results.append({
                'post_id': a.post_id,
                'platform': a.platform,
                'engagement_rate': a.engagement_rate,
                'impressions': a.impressions,
                'likes': a.likes,
                'shares': a.shares,
                'snapshot_type': a.snapshot_type,
            })

        return Response(results)


class RepurposePostView(APIView):
    """Create a repurposed draft from a winning post"""
    permission_classes = [IsAuthenticated, IsCreatorOrAbove]

    def post(self, request, post_id):
        try:
            original = Post.objects.get(id=post_id, user=request.user)
        except Post.DoesNotExist:
            return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = RepurposeRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Create new draft from original
        new_post = Post.objects.create(
            user=request.user,
            caption=original.caption,
            scheduled_time=timezone.now(),
            status='draft',
            brand=original.brand,
            pillar=original.pillar,
            hook=original.hook,
            angle=original.angle,
            format_type=data['repurpose_format'],
            goal=original.goal,
        )
        new_post.update_checklist()

        RepurposedContent.objects.create(
            original_post=original,
            new_post=new_post,
            repurpose_format=data['repurpose_format'],
        )

        return Response({
            'message': 'Repurposed draft created',
            'original_post_id': original.id,
            'new_post_id': new_post.id,
            'repurpose_format': data['repurpose_format'],
        }, status=status.HTTP_201_CREATED)
