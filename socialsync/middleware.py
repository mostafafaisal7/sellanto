"""
Impersonation Middleware for Admin Panel
Allows admin users to act as any user by sending X-Impersonate-User header.

Handles both session-authenticated requests (Django admin) and
JWT-authenticated requests (API calls from React frontend).
"""
from django.contrib.auth.models import User
import logging

logger = logging.getLogger(__name__)


class ImpersonationMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        header = request.META.get('HTTP_X_IMPERSONATE_USER')
        if header:
            admin_user = None

            # Case 1: Session-authenticated request (Django admin views)
            if request.user.is_authenticated and request.user.is_staff:
                admin_user = request.user

            # Case 2: JWT-authenticated request (DRF API calls)
            # Manually validate the JWT token to get the admin user
            elif not request.user.is_authenticated:
                auth_header = request.META.get('HTTP_AUTHORIZATION', '')
                if auth_header.startswith('Bearer '):
                    try:
                        from rest_framework_simplejwt.tokens import AccessToken
                        token_str = auth_header.split(' ', 1)[1]
                        token = AccessToken(token_str)
                        admin_user = User.objects.get(id=token['user_id'])
                        if not admin_user.is_staff:
                            admin_user = None
                    except Exception:
                        pass

            # Perform the user swap
            if admin_user:
                try:
                    target_user = User.objects.get(id=int(header))
                    request._original_user = admin_user
                    request.user = target_user
                except (User.DoesNotExist, ValueError):
                    pass

        return self.get_response(request)
