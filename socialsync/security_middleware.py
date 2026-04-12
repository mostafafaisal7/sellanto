"""
Security Middleware to Detect and Prevent Cross-User Data Access

This middleware logs suspicious access patterns and enforces user data isolation.
"""

import logging
import re
from django.contrib.auth.models import User
from django.http import JsonResponse

logger = logging.getLogger('security')


class UserDataIsolationMiddleware:
    """
    Detects and logs potential cross-user data access attempts.

    This middleware:
    1. Logs all user switches (impersonation)
    2. Detects when API responses contain data from different users
    3. Alerts on suspicious patterns that could indicate data leakage
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Store original user for comparison
        original_user_id = request.user.id if request.user.is_authenticated else None
        impersonating = hasattr(request, '_original_user')

        # Log impersonation
        if impersonating:
            admin_user = request._original_user
            target_user = request.user
            logger.warning(
                f"IMPERSONATION: Admin {admin_user.username} (ID:{admin_user.id}) "
                f"is impersonating {target_user.username} (ID:{target_user.id}) "
                f"on {request.method} {request.path}"
            )

        # Process request
        response = self.get_response(request)

        # For authenticated users, validate response doesn't leak other users' data
        if request.user.is_authenticated and not impersonating:
            self._validate_response_isolation(request, response)

        return response

    def _validate_response_isolation(self, request, response):
        """
        Check if API response contains data from other users.
        This is a heuristic check - adapt based on your API structure.
        """
        # Only check JSON responses
        if not (hasattr(response, 'data') or
                (hasattr(response, 'content') and
                 response.get('Content-Type', '').startswith('application/json'))):
            return

        # Skip validation for non-authenticated endpoints
        if not request.user.is_authenticated:
            return

        current_user_id = request.user.id

        # Parse response content for user_id fields
        try:
            import json
            if hasattr(response, 'content'):
                content = json.loads(response.content)
            elif hasattr(response, 'data'):
                content = response.data
            else:
                return

            # Check for user_id mismatches
            leaked_user_ids = self._find_user_ids_in_response(content, current_user_id)

            if leaked_user_ids:
                logger.critical(
                    f"POTENTIAL DATA LEAKAGE: User {current_user_id} received data "
                    f"containing user_ids: {leaked_user_ids} on {request.method} {request.path}"
                )

                # In strict mode, you could return an error here:
                # return JsonResponse({
                #     'error': 'Data isolation violation detected',
                #     'code': 'DATA_LEAKAGE'
                # }, status=500)

        except Exception as e:
            # Don't break requests due to validation errors
            logger.error(f"Error in data isolation validation: {e}")

    def _find_user_ids_in_response(self, data, current_user_id, path=""):
        """
        Recursively search response data for user_id fields that don't match current user.

        Returns:
            set: User IDs found that don't match the current user
        """
        leaked_ids = set()

        if isinstance(data, dict):
            for key, value in data.items():
                # Check for user_id or user fields
                if key in ('user', 'user_id', 'owner', 'owner_id', 'created_by', 'submitted_by'):
                    if isinstance(value, int) and value != current_user_id:
                        leaked_ids.add(value)
                    elif isinstance(value, dict) and 'id' in value:
                        if value['id'] != current_user_id:
                            leaked_ids.add(value['id'])

                # Recurse into nested structures
                leaked_ids.update(
                    self._find_user_ids_in_response(value, current_user_id, f"{path}.{key}")
                )

        elif isinstance(data, list):
            for i, item in enumerate(data):
                leaked_ids.update(
                    self._find_user_ids_in_response(item, current_user_id, f"{path}[{i}]")
                )

        return leaked_ids


class ConcurrentUserCreationDetector:
    """
    Detects and logs concurrent user creation attempts that could trigger race conditions.
    """

    # Track recent user creation timestamps
    _recent_creations = []
    _max_history = 100

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Detect user registration requests
        if (request.method == 'POST' and
            ('/auth/register/' in request.path or '/auth/register-with-brand/' in request.path)):

            from django.utils import timezone
            now = timezone.now()

            # Log the creation attempt
            self._recent_creations.append(now)

            # Keep only recent history
            if len(self._recent_creations) > self._max_history:
                self._recent_creations = self._recent_creations[-self._max_history:]

            # Check for concurrent registrations (multiple within 1 second)
            recent = [t for t in self._recent_creations if (now - t).total_seconds() < 1.0]

            if len(recent) > 2:
                logger.warning(
                    f"CONCURRENT REGISTRATION DETECTED: {len(recent)} registration attempts "
                    f"within 1 second. This could trigger race conditions. "
                    f"Request from IP: {self._get_client_ip(request)}"
                )

        return self.get_response(request)

    def _get_client_ip(self, request):
        """Get client IP address from request."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip
