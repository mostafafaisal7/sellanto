from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import SystemNotification
from .serializers import SystemNotificationSerializer


class NotificationListView(APIView):
    """List notifications for the current user"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        notifications = SystemNotification.objects.filter(user=request.user)

        # Filters
        event_type = request.query_params.get('event_type')
        if event_type:
            notifications = notifications.filter(event_type=event_type)

        is_read = request.query_params.get('is_read')
        if is_read is not None:
            notifications = notifications.filter(is_read=is_read.lower() == 'true')

        limit = int(request.query_params.get('limit', 50))
        notifications = notifications[:limit]

        serializer = SystemNotificationSerializer(notifications, many=True)
        return Response({
            'count': len(serializer.data),
            'unread_count': SystemNotification.objects.filter(
                user=request.user, is_read=False
            ).count(),
            'notifications': serializer.data,
        })


class MarkNotificationReadView(APIView):
    """Mark a notification as read"""
    permission_classes = [IsAuthenticated]

    def patch(self, request, notification_id):
        try:
            notification = SystemNotification.objects.get(
                id=notification_id, user=request.user
            )
        except SystemNotification.DoesNotExist:
            return Response({'error': 'Notification not found'}, status=status.HTTP_404_NOT_FOUND)

        notification.is_read = True
        notification.save(update_fields=['is_read'])

        return Response({'message': 'Notification marked as read'})


class MarkAllNotificationsReadView(APIView):
    """Mark all notifications as read"""
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        count = SystemNotification.objects.filter(
            user=request.user, is_read=False
        ).update(is_read=True)

        return Response({'message': f'{count} notifications marked as read'})


class DeleteNotificationView(APIView):
    """Delete a notification"""
    permission_classes = [IsAuthenticated]

    def delete(self, request, notification_id):
        try:
            notification = SystemNotification.objects.get(
                id=notification_id, user=request.user
            )
        except SystemNotification.DoesNotExist:
            return Response({'error': 'Notification not found'}, status=status.HTTP_404_NOT_FOUND)

        notification.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class UnreadCountView(APIView):
    """Get unread notification count"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        count = SystemNotification.objects.filter(
            user=request.user, is_read=False
        ).count()
        return Response({'unread_count': count})
