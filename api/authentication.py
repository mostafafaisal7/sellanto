"""
Custom DRF Authentication that supports admin impersonation.

The Django middleware can't handle impersonation for JWT-authenticated requests
because DRF's JWT auth runs at the view level, after all middleware.
This authentication class wraps JWTAuthentication and swaps the user
when the X-Impersonate-User header is present.
"""
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.contrib.auth.models import User


class ImpersonatingJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None

        user, validated_token = result

        # Check for impersonation header
        impersonate_id = request.META.get('HTTP_X_IMPERSONATE_USER')
        if impersonate_id and user.is_staff:
            try:
                target_user = User.objects.get(id=int(impersonate_id))
                # Store the original admin user so admin API views can check permissions
                request._original_user = user
                return (target_user, validated_token)
            except (User.DoesNotExist, ValueError):
                pass

        return result
