from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from datetime import timedelta

from accounts.permissions import IsPublisherOrAbove, IsViewerOrAbove

from posts.models import Post, PostCaption, ScheduledPostPlatform
from brands.models import Brand, BestTimeSuggestion
from accounts.services.notification_service import notify_post_scheduled
from .serializers import (
    ScheduledPostPlatformSerializer, SchedulePostRequestSerializer,
    ConflictCheckRequestSerializer, BestTimeSuggestionSerializer,
    CalendarEventSerializer,
)


class SchedulePostView(APIView):
    """Schedule a post per-platform with specific captions and times"""
    permission_classes = [IsAuthenticated, IsPublisherOrAbove]

    def post(self, request, post_id):
        try:
            post = Post.objects.get(id=post_id, user=request.user)
        except Post.DoesNotExist:
            return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)

        if post.status not in ('draft', 'approved', 'changes_requested'):
            return Response(
                {'error': f'Cannot schedule post with status "{post.status}"'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = SchedulePostRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        created = []
        for item in serializer.validated_data['platforms']:
            platform = item.get('platform')
            caption_id = item.get('caption_id')
            scheduled_at = item.get('scheduled_at')
            tz = item.get('timezone', 'UTC')
            hashtag_placement = item.get('hashtag_placement', 'end_of_caption')

            caption = None
            if caption_id:
                try:
                    caption = PostCaption.objects.get(id=caption_id, post=post)
                except PostCaption.DoesNotExist:
                    pass

            spp = ScheduledPostPlatform.objects.create(
                post=post,
                platform=platform,
                caption=caption,
                hashtag_placement=hashtag_placement,
                scheduled_at=scheduled_at,
                timezone=tz,
                created_by=request.user,
            )
            created.append(spp)

        # Update post status
        post.status = 'scheduled'
        post.scheduled_time = min(s.scheduled_at for s in created) if created else post.scheduled_time
        post.save(update_fields=['status', 'scheduled_time'])

        notify_post_scheduled(post, request.user)

        result = ScheduledPostPlatformSerializer(created, many=True)
        return Response(result.data, status=status.HTTP_201_CREATED)


class RescheduleView(APIView):
    """Reschedule a platform-specific scheduled post"""
    permission_classes = [IsAuthenticated, IsPublisherOrAbove]

    def patch(self, request, spp_id):
        try:
            spp = ScheduledPostPlatform.objects.get(
                id=spp_id, created_by=request.user
            )
        except ScheduledPostPlatform.DoesNotExist:
            return Response({'error': 'Scheduled post not found'}, status=status.HTTP_404_NOT_FOUND)

        if spp.status not in ('scheduled',):
            return Response(
                {'error': 'Can only reschedule posts with status "scheduled"'},
                status=status.HTTP_400_BAD_REQUEST
            )

        new_time = request.data.get('scheduled_at')
        if new_time:
            from django.utils.dateparse import parse_datetime
            parsed = parse_datetime(new_time)
            if parsed:
                spp.scheduled_at = parsed
                spp.save(update_fields=['scheduled_at'])

        return Response(ScheduledPostPlatformSerializer(spp).data)


class CalendarView(APIView):
    """Get calendar data for FullCalendar integration"""
    permission_classes = [IsAuthenticated, IsViewerOrAbove]

    def get(self, request):
        start = request.query_params.get('start')
        end = request.query_params.get('end')

        posts = Post.objects.filter(user=request.user).exclude(
            status__in=['cancelled']
        ).select_related('pillar', 'brand')

        if start:
            from django.utils.dateparse import parse_datetime
            start_dt = parse_datetime(start)
            if start_dt:
                posts = posts.filter(scheduled_time__gte=start_dt)
        if end:
            from django.utils.dateparse import parse_datetime
            end_dt = parse_datetime(end)
            if end_dt:
                posts = posts.filter(scheduled_time__lte=end_dt)

        # Build calendar events
        events = []
        platform_colors = {
            'twitter': '#1DA1F2',
            'linkedin': '#0A66C2',
            'facebook': '#1877F2',
            'instagram': '#E4405F',
        }

        for post in posts:
            platforms = post.platforms_list
            for platform in platforms:
                events.append({
                    'id': post.id,
                    'title': (post.caption[:50] + '...') if len(post.caption) > 50 else post.caption,
                    'start': post.scheduled_time.isoformat(),
                    'platform': platform,
                    'status': post.status,
                    'color': platform_colors.get(platform, '#6B7280'),
                    'pillar_name': post.pillar.name if post.pillar else '',
                    'pillar_color': post.pillar.color_code if post.pillar else '',
                })

        return Response(events)


class BestTimeSuggestionsView(APIView):
    permission_classes = [IsAuthenticated, IsViewerOrAbove]

    def get(self, request, brand_id):
        try:
            brand = Brand.objects.get(id=brand_id, workspace__owner=request.user)
        except Brand.DoesNotExist:
            return Response({'error': 'Brand not found'}, status=status.HTTP_404_NOT_FOUND)

        suggestions = BestTimeSuggestion.objects.filter(brand=brand).order_by('-score')
        platform = request.query_params.get('platform')
        if platform:
            suggestions = suggestions.filter(platform=platform)

        serializer = BestTimeSuggestionSerializer(suggestions, many=True)
        return Response(serializer.data)


class ConflictCheckView(APIView):
    """Check for scheduling conflicts (same platform within buffer window)"""
    permission_classes = [IsAuthenticated, IsViewerOrAbove]

    def post(self, request):
        serializer = ConflictCheckRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        platform = data['platform']
        scheduled_at = data['scheduled_at']
        buffer = data.get('buffer_minutes', 30)

        window_start = scheduled_at - timedelta(minutes=buffer)
        window_end = scheduled_at + timedelta(minutes=buffer)

        conflicts = ScheduledPostPlatform.objects.filter(
            platform=platform,
            scheduled_at__range=(window_start, window_end),
            status='scheduled',
            created_by=request.user,
        ).select_related('post')

        if conflicts.exists():
            conflict_data = ScheduledPostPlatformSerializer(conflicts, many=True).data
            return Response({
                'has_conflict': True,
                'conflicts': conflict_data,
                'message': f'{conflicts.count()} post(s) scheduled within {buffer} minutes on {platform}',
            })

        return Response({
            'has_conflict': False,
            'conflicts': [],
            'message': 'No conflicts detected',
        })
