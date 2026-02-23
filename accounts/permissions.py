"""
V1.2.1 RBAC Permission Classes

Roles:
- Owner: Full control (workspace creator always has this)
- Admin: Operations manager
- Creator: Content producer
- Approver: Quality gate / reviewer
- Publisher: Granted permission to schedule & publish
- Viewer: Read-only stakeholder
"""
from rest_framework.permissions import BasePermission

from accounts.models import UserRole


def _get_workspace(request, view):
    """Extract workspace from the request context (brand, post, or direct)."""
    # Direct workspace_id
    workspace_id = (
        view.kwargs.get('workspace_id')
        or request.data.get('workspace_id')
        or request.query_params.get('workspace_id')
    )
    if workspace_id:
        from brands.models import Workspace
        try:
            return Workspace.objects.get(id=workspace_id)
        except Workspace.DoesNotExist:
            return None

    # Via brand_id
    brand_id = view.kwargs.get('brand_id') or request.data.get('brand_id')
    if brand_id:
        from brands.models import Brand
        try:
            return Brand.objects.get(id=brand_id).workspace
        except Brand.DoesNotExist:
            return None

    # Via post_id
    post_id = view.kwargs.get('post_id')
    if post_id:
        from posts.models import Post
        try:
            post = Post.objects.select_related('brand__workspace').get(id=post_id)
            if post.brand and post.brand.workspace:
                return post.brand.workspace
        except Post.DoesNotExist:
            pass

    # Fallback: user's first workspace
    from brands.models import Workspace
    ws = Workspace.objects.filter(owner=request.user).first()
    return ws


class IsWorkspaceOwner(BasePermission):
    """Only workspace owner."""

    def has_permission(self, request, view):
        ws = _get_workspace(request, view)
        if not ws:
            return True  # Let view handle 404
        return ws.owner == request.user


class IsWorkspaceAdmin(BasePermission):
    """Owner or Admin role."""

    def has_permission(self, request, view):
        ws = _get_workspace(request, view)
        if not ws:
            return True
        return UserRole.has_any_role(request.user, ws, ['owner', 'admin'])


class IsCreatorOrAbove(BasePermission):
    """Owner, Admin, or Creator."""

    def has_permission(self, request, view):
        ws = _get_workspace(request, view)
        if not ws:
            return True
        return UserRole.has_any_role(request.user, ws, ['owner', 'admin', 'creator'])


class IsApproverOrAbove(BasePermission):
    """Owner, Admin, or Approver."""

    def has_permission(self, request, view):
        ws = _get_workspace(request, view)
        if not ws:
            return True
        return UserRole.has_any_role(request.user, ws, ['owner', 'admin', 'approver'])


class IsPublisherOrAbove(BasePermission):
    """Owner, Admin, or Publisher."""

    def has_permission(self, request, view):
        ws = _get_workspace(request, view)
        if not ws:
            return True
        return UserRole.has_any_role(request.user, ws, ['owner', 'admin', 'publisher'])


class IsViewerOrAbove(BasePermission):
    """Any workspace member (any role)."""

    def has_permission(self, request, view):
        ws = _get_workspace(request, view)
        if not ws:
            return True
        return UserRole.has_any_role(
            request.user, ws,
            ['owner', 'admin', 'creator', 'approver', 'publisher', 'viewer']
        )
