from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone

from accounts.permissions import IsCreatorOrAbove, IsApproverOrAbove, IsViewerOrAbove

from posts.models import Post
from brands.models import ApprovalLog, ContentApproval
from accounts.services.notification_service import (
    notify_post_submitted, notify_post_approved,
    notify_changes_requested, notify_post_rejected,
)
from .serializers import (
    ApprovalLogSerializer, SubmitForApprovalSerializer,
    ApprovePostSerializer, RequestChangesSerializer, RejectPostSerializer,
    PostDetailSerializer,
)


class SubmitForApprovalView(APIView):
    permission_classes = [IsAuthenticated, IsCreatorOrAbove]

    def post(self, request, post_id):
        try:
            post = Post.objects.get(id=post_id, user=request.user)
        except Post.DoesNotExist:
            return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)

        if post.status not in ('draft', 'changes_requested'):
            return Response(
                {'error': f'Cannot submit post with status "{post.status}"'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Server-side checklist validation
        post.update_checklist()
        if not post.is_checklist_complete:
            checklist = post.checklist_status or {}
            missing = [k for k, v in checklist.items() if not v]
            return Response(
                {
                    'error': 'Checklist incomplete. Complete all required items before submitting.',
                    'missing_items': missing,
                    'checklist': checklist,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = SubmitForApprovalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        post.status = 'pending_approval'
        post.submitted_at = timezone.now()
        post.save(update_fields=['status', 'submitted_at'])

        ApprovalLog.objects.create(
            post=post,
            action='submitted',
            acted_by=request.user,
            comment=serializer.validated_data.get('comment', ''),
        )

        notify_post_submitted(post, request.user)

        return Response({
            'message': 'Post submitted for approval',
            'post_id': post.id,
            'status': post.status,
        })


class ApprovePostView(APIView):
    permission_classes = [IsAuthenticated, IsApproverOrAbove]

    def post(self, request, post_id):
        try:
            post = Post.objects.get(id=post_id)
        except Post.DoesNotExist:
            return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)

        if post.status != 'pending_approval':
            return Response(
                {'error': f'Cannot approve post with status "{post.status}"'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = ApprovePostSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        post.status = 'approved'
        post.approved_at = timezone.now()
        post.save(update_fields=['status', 'approved_at'])

        ApprovalLog.objects.create(
            post=post,
            action='approved',
            acted_by=request.user,
            comment=serializer.validated_data.get('comment', ''),
        )

        notify_post_approved(post, request.user)

        return Response({
            'message': 'Post approved',
            'post_id': post.id,
            'status': post.status,
        })


class RequestChangesView(APIView):
    permission_classes = [IsAuthenticated, IsApproverOrAbove]

    def post(self, request, post_id):
        try:
            post = Post.objects.get(id=post_id)
        except Post.DoesNotExist:
            return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)

        if post.status != 'pending_approval':
            return Response(
                {'error': f'Cannot request changes for post with status "{post.status}"'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = RequestChangesSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        post.status = 'changes_requested'
        post.save(update_fields=['status'])

        comment_text = serializer.validated_data['comment']

        ApprovalLog.objects.create(
            post=post,
            action='changes_requested',
            acted_by=request.user,
            comment=comment_text,
        )

        notify_changes_requested(post, request.user, comment_text)

        return Response({
            'message': 'Changes requested',
            'post_id': post.id,
            'status': post.status,
        })


class RejectPostView(APIView):
    permission_classes = [IsAuthenticated, IsApproverOrAbove]

    def post(self, request, post_id):
        try:
            post = Post.objects.get(id=post_id)
        except Post.DoesNotExist:
            return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)

        if post.status != 'pending_approval':
            return Response(
                {'error': f'Cannot reject post with status "{post.status}"'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = RejectPostSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        post.status = 'rejected'
        post.save(update_fields=['status'])

        rejection_reason = serializer.validated_data['rejection_reason']

        ApprovalLog.objects.create(
            post=post,
            action='rejected',
            acted_by=request.user,
            comment=serializer.validated_data.get('comment', ''),
            rejection_reason=rejection_reason,
        )

        notify_post_rejected(post, request.user, rejection_reason)

        return Response({
            'message': 'Post rejected',
            'post_id': post.id,
            'status': post.status,
        })


class PendingApprovalsView(APIView):
    permission_classes = [IsAuthenticated, IsApproverOrAbove]

    def get(self, request):
        posts = Post.objects.filter(
            status='pending_approval',
            brand__workspace__owner=request.user
        ).select_related('brand', 'pillar', 'user').order_by('-submitted_at')

        serializer = PostDetailSerializer(posts, many=True)
        return Response(serializer.data)


class ApprovalLogView(APIView):
    permission_classes = [IsAuthenticated, IsViewerOrAbove]

    def get(self, request, post_id):
        logs = ApprovalLog.objects.filter(
            post_id=post_id
        ).select_related('acted_by').order_by('-created_at')

        serializer = ApprovalLogSerializer(logs, many=True)
        return Response(serializer.data)


class DraftChecklistView(APIView):
    permission_classes = [IsAuthenticated, IsCreatorOrAbove]

    def get(self, request, post_id):
        try:
            post = Post.objects.get(id=post_id, user=request.user)
        except Post.DoesNotExist:
            return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)

        checklist = post.update_checklist()
        return Response({
            'post_id': post.id,
            'checklist': checklist,
            'is_complete': post.is_checklist_complete,
        })
