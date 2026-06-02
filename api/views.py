from rest_framework import viewsets, status, generics
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db.models import Q, Sum, Count
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from datetime import timedelta
import json

import openai
import logging

from accounts.models import UserProfile, SiteConfiguration, UserRole
from accounts.api_keys import get_openai_key
from accounts.services.llm_service import get_llm_service, UnifiedLLMService, extract_json_object
from accounts.services.prompt_resolver import resolve_prompt
from posts.models import Post
from platforms.models import SocialAccount
from ai_caption.models import CaptionGeneration, CaptionTemplate, SavedCaption, UserAPISettings
from ai_image.models import ImageGeneration, SavedImage, UserLogo, PromptTemplate, UserImageSettings
from messenger_bot.models import (
    MessengerConnection, AIConfiguration, PDFKnowledgeBase,
    Conversation, Message, Notification, CustomPrompt,
    ECommerceSettings, Product
)
from onboarding.models import OnboardingProgress
from accounts.services.notification_service import notify_images_ready, notify_daily_limit_warning
from brands.models import (
    Workspace, Brand, BrandAsset, LaunchPlan,
    ContentIdea, ContentApproval, WeeklyReport, GenerationUsage,
    BrandDNAChunk
)

from .serializers import (
    UserSerializer,
    UserDetailSerializer,
    UserProfileDetailSerializer,
    UpdateProfileSerializer,
    RegisterSerializer,
    RegisterWithBrandSerializer,
    LoginSerializer,
    PostSerializer,
    CreatePostSerializer,
    UpdatePostSerializer,
    SocialAccountSerializer,
    SocialAccountDetailSerializer,
    DashboardStatsSerializer,
    # AI Caption
    CaptionGenerationSerializer,
    CaptionTemplateSerializer,
    SavedCaptionSerializer,
    UserAPISettingsSerializer,
    # AI Image
    ImageGenerationSerializer,
    SavedImageSerializer,
    UserLogoSerializer,
    PromptTemplateSerializer,
    UserImageSettingsSerializer,
    GenerateImageSerializer,
    # Onboarding
    OnboardingProgressSerializer,
    OnboardingStatusSerializer,
    # Brands & Workspace
    WorkspaceSerializer,
    BrandSerializer,
    BrandAssetSerializer,
    LaunchPlanSerializer,
    ContentIdeaSerializer,
    ContentIdeaDetailSerializer,
    ContentApprovalSerializer,
    WeeklyReportSerializer,
    GenerationUsageSerializer,
    GlobalAPIKeysSerializer,
    # Brand DNA
    BrandDNAChunkSerializer,
    BrandDNAStatusSerializer,
    # Messenger Bot
    MessengerConnectionSerializer,
    AIConfigurationSerializer,
    PDFKnowledgeBaseSerializer,
    ConversationSerializer,
    ConversationListSerializer,
    MessageSerializer,
    NotificationSerializer,
    CustomPromptSerializer,
    ECommerceSettingsSerializer,
    ProductSerializer,
    ProductListSerializer,
)

from accounts.api_keys import get_openai_key, get_gemini_key, get_claude_key, mask_key
from accounts.services.diamond_service import pre_check, deduct_diamonds
from .db_utils import safe_model_save


def diamond_gate(user, feature, **kwargs):
    """Check diamond balance before AI call. Returns error Response or None."""
    can_afford, cost, balance = pre_check(user, feature, **kwargs)
    if not can_afford:
        return Response({
            'error': 'Insufficient Diamond Tokens',
            'diamond_cost': cost,
            'diamond_balance': balance,
            'code': 'INSUFFICIENT_DIAMONDS',
        }, status=402)
    return None


# ===================== AUTH VIEWS =====================

@method_decorator(csrf_exempt, name='dispatch')
class RegisterView(generics.CreateAPIView):
    """User registration endpoint.

    Creates the user but does NOT return JWT tokens. The user must first enter
    a 6-digit OTP emailed to them (see VerifyOTPView). This way the email
    address is verified before they can log in.
    """
    permission_classes = [AllowAny]
    authentication_classes = []
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Issue OTP and email it. Email failures are non-fatal — the user
        # can still hit /resend-otp/ if SMTP was misconfigured.
        from accounts.models import EmailOTP
        from accounts.services.email_service import send_otp_email
        otp = EmailOTP.issue(user)
        send_otp_email(user, otp.code, ttl_seconds=EmailOTP.CODE_TTL_SECONDS)

        return Response({
            'message': 'Verification code sent to your email.',
            'requires_verification': True,
            'user_id': user.id,
            'email': user.email,
            'otp_ttl_seconds': EmailOTP.CODE_TTL_SECONDS,
        }, status=status.HTTP_201_CREATED)


@method_decorator(csrf_exempt, name='dispatch')
class RegisterWithBrandView(APIView):
    """Register user + create Workspace + Brand + structured DNA in one call"""
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = RegisterWithBrandSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user, workspace, brand = serializer.save()

        # Best-effort AI enhancement if website_url + server OPENAI_API_KEY exist
        ai_enhanced = False
        if brand.website_url:
            try:
                from django.conf import settings as django_settings
                server_key = getattr(django_settings, 'OPENAI_API_KEY', '')
                if server_key:
                    from api.strategy_views import _crawl_site_pages, _fetch_page_content
                    try:
                        pages = _crawl_site_pages(brand.website_url, max_pages=3)
                        if pages:
                            combined_content = ''
                            for p in pages:
                                combined_content += f"\n--- {p.get('url', '')} ---\n{p.get('content', '')}\n"
                            page_data = {
                                'success': True,
                                'title': pages[0].get('title', ''),
                                'description': pages[0].get('description', ''),
                                'content': combined_content[:6000],
                            }
                        else:
                            page_data = _fetch_page_content(brand.website_url)
                    except Exception:
                        page_data = _fetch_page_content(brand.website_url)

                    if page_data.get('success'):
                        service = UnifiedLLMService(openai_key=server_key, claude_key=get_claude_key())
                        existing_dna = json.dumps(brand.brand_dna, indent=2)
                        website_content = page_data.get('content', '')
                        prompt = f"""<task>
Enhance the existing Brand DNA using website content. Keep ALL existing values but fill gaps and enrich thin descriptions with evidence from the website.
</task>

<existing_dna>
{existing_dna}
</existing_dna>

<website_data>
URL: {brand.website_url}
Content: {website_content}
</website_data>

<instructions>
For each of the 15 fields:
1. If the field has a strong value, keep it exactly as-is.
2. If the field has a thin/generic value, enrich it with website evidence while preserving the original intent.
3. If the field is empty, fill it using website content.
4. Return all 15 fields in the output.
</instructions>

<output_format>
Return ONLY a single JSON object with all 15 Brand DNA fields.
</output_format>"""

                        # Per-user admin override of the brand-DNA prompt
                        import time as _bd_time
                        from accounts.services.prompt_resolver import save_execution as _bd_save_exec
                        prompt, _bd_was_override = resolve_prompt(
                            request.user, 'brand_dna', prompt,
                            {
                                'existing_dna': existing_dna,
                                'website_url': brand.website_url,
                                'website_content': website_content,
                            },
                            return_meta=True,
                        )

                        _bd_system = 'You are a brand strategist specializing in enriching brand identity profiles. Your task is to enhance an existing Brand DNA by cross-referencing it with fresh website data — filling gaps, adding specificity, and improving strategic usefulness WITHOUT overwriting the user\'s original input.\n\nPrinciples:\n- User-provided values are sacred — enhance, never replace\n- Empty fields are opportunities — fill them with evidence-based content\n- Thin descriptions should be enriched with specifics from the website\n- The enhanced DNA should be immediately useful for content creation\n\nReturn ONLY valid JSON — no markdown, no commentary.'
                        _bd_t0 = _bd_time.monotonic()
                        result = service.chat_completion(
                            messages=[
                                {'role': 'system', 'content': _bd_system},
                                {'role': 'user', 'content': prompt},
                            ],
                            temperature=0.3,
                            max_tokens=2500,
                        )
                        _bd_latency = int((_bd_time.monotonic() - _bd_t0) * 1000)
                        _bd_save_exec(
                            request.user, 'brand_dna',
                            f"SYSTEM:\n{_bd_system}\n\nUSER:\n{prompt}",
                            response_received=(result.content if result.success else ''),
                            was_override=_bd_was_override,
                            model_used=getattr(result, 'model', ''),
                            tokens_in=getattr(result, 'input_tokens', 0),
                            tokens_out=getattr(result, 'output_tokens', 0),
                            latency_ms=_bd_latency, success=result.success,
                            error_message=result.error or '',
                            brand=brand,
                        )
                        if not result.success:
                            raise Exception(result.error)
                        enhanced_dna = extract_json_object(result.content)
                        enhanced_dna['website_url'] = brand.website_url
                        brand.brand_dna = enhanced_dna
                        brand.brand_dna_source = 'website'
                        brand.brand_dna_generated_at = timezone.now()
                        brand.save(update_fields=['brand_dna', 'brand_dna_source', 'brand_dna_generated_at'])

                        from brands.models import BrandDNAHistory
                        BrandDNAHistory.objects.filter(brand=brand).update(is_active=False)
                        BrandDNAHistory.objects.create(
                            brand=brand, dna_data=enhanced_dna,
                            website_url=brand.website_url, source='website', is_active=True,
                        )
                        ai_enhanced = True
            except Exception:
                pass  # AI enhancement is best-effort; structured DNA is already saved

        # Issue OTP and email it. JWT tokens are NOT returned here — the user
        # must verify the OTP before they can log in (see VerifyOTPView).
        from accounts.models import EmailOTP
        from accounts.services.email_service import send_otp_email
        otp = EmailOTP.issue(user)
        send_otp_email(user, otp.code, ttl_seconds=EmailOTP.CODE_TTL_SECONDS)

        return Response({
            'message': 'Verification code sent to your email.',
            'requires_verification': True,
            'user_id': user.id,
            'email': user.email,
            'otp_ttl_seconds': EmailOTP.CODE_TTL_SECONDS,
            'workspace_id': workspace.id,
            'brand_id': brand.id,
            'brand_dna': brand.brand_dna,
            'ai_enhanced': ai_enhanced,
        }, status=status.HTTP_201_CREATED)


@method_decorator(csrf_exempt, name='dispatch')
class LoginView(APIView):
    """User login endpoint - returns JWT tokens"""
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        identifier = serializer.validated_data['username']
        password = serializer.validated_data['password']

        # Try direct username match first, then fall back to email lookup so
        # users can sign in with either their username or their email address.
        user = authenticate(username=identifier, password=password)
        if not user:
            try:
                found = User.objects.get(email__iexact=identifier)
                user = authenticate(username=found.username, password=password)
            except (User.DoesNotExist, User.MultipleObjectsReturned):
                pass

        if not user:
            return Response(
                {'error': 'Invalid username or password'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Block login until first-time email OTP has been verified. Staff/
        # superusers (existing admin accounts pre-OTP feature) skip the gate.
        try:
            profile = user.profile
        except Exception:
            profile = None
        if profile and not profile.email_verified and not (user.is_staff or user.is_superuser):
            from accounts.models import EmailOTP
            from accounts.services.email_service import send_otp_email
            otp = EmailOTP.issue(user)
            send_otp_email(user, otp.code, ttl_seconds=EmailOTP.CODE_TTL_SECONDS)
            return Response({
                'error': 'Email not verified. Check your inbox for a 6-digit code.',
                'requires_verification': True,
                'user_id': user.id,
                'email': user.email,
                'otp_ttl_seconds': EmailOTP.CODE_TTL_SECONDS,
            }, status=status.HTTP_403_FORBIDDEN)

        # Generate tokens
        refresh = RefreshToken.for_user(user)

        return Response({
            'user': UserSerializer(user).data,
            'tokens': {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            }
        })


@method_decorator(csrf_exempt, name='dispatch')
class VerifyOTPView(APIView):
    """POST /api/v1/auth/verify-otp/   { user_id, code }

    Validates the 6-digit code emailed at signup. On success: marks the
    user's profile as email_verified, sends the welcome email, and returns
    JWT tokens so the SPA can log them in immediately.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        from accounts.models import EmailOTP
        from accounts.services.email_service import send_welcome_email

        data = request.data or {}
        user_id = data.get('user_id')
        code = (data.get('code') or '').strip()

        if not user_id or not code:
            return Response(
                {'error': 'user_id and code are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.get(id=int(user_id))
        except (User.DoesNotExist, ValueError, TypeError):
            return Response(
                {'error': 'User not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        ok, message = EmailOTP.verify(user, code)
        if not ok:
            return Response({'error': message}, status=status.HTTP_400_BAD_REQUEST)

        # First-time success: flip the flag and send the welcome email.
        try:
            profile = user.profile
            already_verified = profile.email_verified
            if not already_verified:
                profile.email_verified = True
                profile.save(update_fields=['email_verified'])
        except Exception:
            already_verified = False

        if not already_verified:
            send_welcome_email(user)

        refresh = RefreshToken.for_user(user)
        return Response({
            'message': 'Email verified.',
            'user': UserSerializer(user).data,
            'tokens': {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            },
        })


@method_decorator(csrf_exempt, name='dispatch')
class ResendOTPView(APIView):
    """POST /api/v1/auth/resend-otp/   { user_id }

    Issues a fresh 60-second OTP and emails it. Existing unused codes for
    the same user are invalidated by EmailOTP.issue().
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        from accounts.models import EmailOTP
        from accounts.services.email_service import send_otp_email

        data = request.data or {}
        user_id = data.get('user_id')
        if not user_id:
            return Response(
                {'error': 'user_id is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.get(id=int(user_id))
        except (User.DoesNotExist, ValueError, TypeError):
            return Response(
                {'error': 'User not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        otp = EmailOTP.issue(user)
        sent = send_otp_email(user, otp.code, ttl_seconds=EmailOTP.CODE_TTL_SECONDS)

        return Response({
            'message': 'A new code has been sent to your email.' if sent
                       else 'Code generated, but email could not be sent.',
            'otp_ttl_seconds': EmailOTP.CODE_TTL_SECONDS,
            'email_sent': sent,
        })


@method_decorator(csrf_exempt, name='dispatch')
class LogoutView(APIView):
    """User logout - blacklist refresh token"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            return Response({'message': 'Logout successful'})
        except Exception:
            return Response({'message': 'Logout successful'})


class CurrentUserView(generics.RetrieveUpdateAPIView):
    """Get/update current authenticated user"""
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


# ===================== PASSWORD MANAGEMENT VIEWS =====================

@method_decorator(csrf_exempt, name='dispatch')
class ChangePasswordView(APIView):
    """POST /api/v1/auth/change-password/   { current_password, new_password }

    Authenticated user changes their own password by proving they know
    the current one. We don't blacklist refresh tokens here — the user
    intentionally initiated this change, so keeping their session alive
    is the friendly behavior.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError as DjangoValidationError

        data = request.data or {}
        current_password = (data.get('current_password') or '').strip()
        new_password = data.get('new_password') or ''

        if not current_password or not new_password:
            return Response(
                {'error': 'Both current_password and new_password are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user
        if not user.check_password(current_password):
            return Response(
                {'error': 'Current password is incorrect.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(new_password) < 6:
            return Response(
                {'error': 'New password must be at least 6 characters.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if new_password == current_password:
            return Response(
                {'error': 'New password must be different from your current password.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            validate_password(new_password, user=user)
        except DjangoValidationError as e:
            return Response({'error': ' '.join(e.messages)}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save(update_fields=['password'])

        return Response({'message': 'Password changed successfully.'})


@method_decorator(csrf_exempt, name='dispatch')
class ForgotPasswordRequestView(APIView):
    """POST /api/v1/auth/forgot-password/   { email }

    Issues a 6-digit OTP for password reset and emails it. Returns the
    user_id so the SPA can pair it with the OTP on the verify step.
    Existing pending password-reset codes for the same user are invalidated.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        from accounts.models import EmailOTP
        from accounts.services.email_service import send_password_reset_otp_email

        data = request.data or {}
        email = (data.get('email') or '').strip().lower()

        if not email:
            return Response(
                {'error': 'Email is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Email is the canonical identifier here. If the same email maps to
        # multiple accounts (legacy data), take the most recently active one.
        user = (
            User.objects
            .filter(email__iexact=email)
            .order_by('-last_login', '-date_joined')
            .first()
        )
        if not user:
            return Response(
                {'error': 'No account found with that email address.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        otp = EmailOTP.issue(user, purpose=EmailOTP.PURPOSE_PASSWORD_RESET)
        sent = send_password_reset_otp_email(user, otp.code, ttl_seconds=EmailOTP.CODE_TTL_SECONDS)

        return Response({
            'message': 'A password reset code has been sent to your email.' if sent
                       else 'Code generated, but email could not be sent. Try resending.',
            'user_id': user.id,
            'username': user.username,
            'email': user.email,
            'otp_ttl_seconds': EmailOTP.CODE_TTL_SECONDS,
            'email_sent': sent,
        })


@method_decorator(csrf_exempt, name='dispatch')
class ForgotPasswordResendView(APIView):
    """POST /api/v1/auth/forgot-password/resend/   { user_id }

    Re-issues a fresh password-reset OTP for the user. Mirrors ResendOTPView
    but scoped to the password_reset purpose so it doesn't disturb a
    pending signup OTP.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        from accounts.models import EmailOTP
        from accounts.services.email_service import send_password_reset_otp_email

        data = request.data or {}
        user_id = data.get('user_id')
        if not user_id:
            return Response(
                {'error': 'user_id is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.get(id=int(user_id))
        except (User.DoesNotExist, ValueError, TypeError):
            return Response(
                {'error': 'User not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        otp = EmailOTP.issue(user, purpose=EmailOTP.PURPOSE_PASSWORD_RESET)
        sent = send_password_reset_otp_email(user, otp.code, ttl_seconds=EmailOTP.CODE_TTL_SECONDS)

        return Response({
            'message': 'A new code has been sent to your email.' if sent
                       else 'Code generated, but email could not be sent.',
            'otp_ttl_seconds': EmailOTP.CODE_TTL_SECONDS,
            'email_sent': sent,
        })


@method_decorator(csrf_exempt, name='dispatch')
class ForgotPasswordVerifyView(APIView):
    """POST /api/v1/auth/forgot-password/verify/   { user_id, code, new_password }

    Verifies the password-reset OTP and sets the new password. On success
    we also blacklist outstanding refresh tokens defensively — if the
    account was compromised, the attacker's session should not survive
    the password change.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        from accounts.models import EmailOTP
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError as DjangoValidationError

        data = request.data or {}
        user_id = data.get('user_id')
        code = (data.get('code') or '').strip()
        new_password = data.get('new_password') or ''

        if not user_id or not code or not new_password:
            return Response(
                {'error': 'user_id, code and new_password are all required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(new_password) < 6:
            return Response(
                {'error': 'New password must be at least 6 characters.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.get(id=int(user_id))
        except (User.DoesNotExist, ValueError, TypeError):
            return Response(
                {'error': 'User not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            validate_password(new_password, user=user)
        except DjangoValidationError as e:
            return Response({'error': ' '.join(e.messages)}, status=status.HTTP_400_BAD_REQUEST)

        ok, message = EmailOTP.verify(user, code, purpose=EmailOTP.PURPOSE_PASSWORD_RESET)
        if not ok:
            return Response({'error': message}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save(update_fields=['password'])

        # If a forgot-password flow is being used and the email wasn't yet
        # verified, this counts as proof of email ownership.
        try:
            profile = user.profile
            if not profile.email_verified:
                profile.email_verified = True
                profile.save(update_fields=['email_verified'])
        except Exception:
            pass

        return Response({'message': 'Password reset successfully. You can now sign in with your new password.'})


# ===================== DASHBOARD VIEWS =====================

class DashboardStatsView(APIView):
    """Get dashboard statistics"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        posts = Post.objects.filter(user=user)

        stats = {
            'total_posts': posts.count(),
            'scheduled_posts': posts.filter(status='scheduled').count(),
            'posted_posts': posts.filter(status='posted').count(),
            'failed_posts': posts.filter(status='failed').count(),
            'posts_this_month': getattr(user.profile, 'posts_this_month', 0) if hasattr(user, 'profile') else 0,
            'connected_accounts': SocialAccount.objects.filter(user=user, is_active=True).count(),
            'subscription_plan': getattr(user.profile, 'subscription_plan', 'free') if hasattr(user, 'profile') else 'free',
            'max_posts_per_month': getattr(user.profile, 'max_posts_per_month', 50) if hasattr(user, 'profile') else 50,
            'max_social_accounts': getattr(user.profile, 'max_social_accounts', 5) if hasattr(user, 'profile') else 5,
        }

        serializer = DashboardStatsSerializer(stats)
        return Response(serializer.data)


class RecentPostsView(generics.ListAPIView):
    """Get recent posts for dashboard"""
    serializer_class = PostSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        limit = int(self.request.query_params.get('limit', 5))
        return Post.objects.filter(user=self.request.user).order_by('-created_at')[:limit]


# ===================== POSTS VIEWS =====================

def _resolve_owned_media_paths(user, raw_paths, video_generation_id=None):
    """Resolve user-supplied media references to MEDIA_ROOT-relative paths the
    user actually owns.

    Accepts a list of /media/-relative paths or absolute media URLs (e.g. an
    AI-generated image URL) plus an optional video generation id, and returns
    the safe relative paths (the same format uploaded files are stored as).
    This lets already-generated media be attached to a draft *by reference*
    instead of being re-downloaded and re-uploaded from the browser — the
    fragile path that was silently dropping media from Magic drafts.

    Anything that fails path-safety or ownership checks is silently dropped, so
    a bad reference can never raise or break draft creation.
    """
    import os
    from urllib.parse import urlparse, unquote
    from django.conf import settings
    from ai_video.models import VideoGeneration

    media_root = os.path.realpath(settings.MEDIA_ROOT)
    media_url = settings.MEDIA_URL or '/media/'
    resolved = []

    def _normalize(raw):
        if not isinstance(raw, str) or not raw.strip():
            return None
        rel = raw.strip()
        if rel.startswith('http://') or rel.startswith('https://'):
            rel = urlparse(rel).path
        rel = unquote(rel).replace('\\', '/')
        if media_url and rel.startswith(media_url):
            rel = rel[len(media_url):]
        rel = rel.lstrip('/')
        # Reject empty, traversal, absolute or drive-qualified paths
        if not rel or '..' in rel.split('/') or ':' in rel:
            return None
        full = os.path.realpath(os.path.join(media_root, rel))
        if full != media_root and not full.startswith(media_root + os.sep):
            return None
        return rel

    # Ownership: media generated for this user always lives under one of these
    # per-user subtrees (see ai_image/ai_video upload_to helpers). Matching the
    # subtree is far more robust than exact FileField equality, which silently
    # failed for the copy-overlay variant, absolute URLs, or any path variance.
    user_prefixes = (
        f'generated_images/{user.id}/',
        f'generated_videos/{user.id}/',
        f'video_thumbnails/{user.id}/',
        f'posts/{user.id}/',
    )

    def _is_owned(rel):
        if rel.startswith(user_prefixes):  # str.startswith accepts a tuple
            return True
        # Fallback: exact match against the user's own generation records.
        return (
            ImageGeneration.objects.filter(user=user).filter(
                Q(generated_image=rel)
                | Q(generated_image_with_logo=rel)
                | Q(composited_image=rel)
            ).exists()
            or VideoGeneration.objects.filter(user=user).filter(
                Q(generated_video=rel)
                | Q(generated_video_with_logo=rel)
                | Q(thumbnail=rel)
            ).exists()
        )

    for raw in (raw_paths or []):
        rel = _normalize(raw)
        if rel and rel not in resolved and _is_owned(rel):
            resolved.append(rel)

    if video_generation_id not in (None, '', 'null'):
        try:
            vg = VideoGeneration.objects.filter(
                user=user, id=int(video_generation_id)
            ).first()
        except (ValueError, TypeError):
            vg = None
        if vg:
            # Prefer the model's display helper; fall back to the raw fields.
            display = vg.get_display_video() if hasattr(vg, 'get_display_video') else None
            name = getattr(display, 'name', None) if display else None
            if not name:
                name = (getattr(vg.generated_video_with_logo, 'name', None)
                        or getattr(vg.generated_video, 'name', None))
            if name and name not in resolved:
                resolved.append(name)

    return resolved


class PostViewSet(viewsets.ModelViewSet):
    """ViewSet for Post CRUD operations"""
    serializer_class = PostSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Post.objects.filter(user=self.request.user).order_by('-created_at')

        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # Filter by platform
        platform = self.request.query_params.get('platform')
        if platform:
            queryset = queryset.filter(platforms__icontains=platform)

        # Filter by source
        source = self.request.query_params.get('source')
        if source:
            queryset = queryset.filter(source=source)

        # Search
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(caption__icontains=search)

        return queryset

    def create(self, request, *args, **kwargs):
        # Convert QueryDict to regular dict for proper list handling
        data = dict(request.data)

        # Handle single-item lists from QueryDict (QueryDict wraps values in lists)
        for key, value in data.items():
            if isinstance(value, list) and len(value) == 1 and key != 'platforms':
                data[key] = value[0]

        platforms_raw = data.get('platforms')

        # Debug logging
        print(f"DEBUG: Raw platforms type: {type(platforms_raw)}, value: {platforms_raw}")

        # Parse platforms from various formats
        platforms_list = []
        if platforms_raw:
            if isinstance(platforms_raw, str):
                try:
                    # Try parsing if it's a JSON string
                    parsed = json.loads(platforms_raw)
                    if isinstance(parsed, list):
                        platforms_list = [str(p) for p in parsed]
                    else:
                        platforms_list = [str(parsed)]
                except (json.JSONDecodeError, TypeError):
                    # If not JSON, but a comma-separated string
                    if ',' in platforms_raw:
                        platforms_list = [p.strip() for p in platforms_raw.split(',')]
                    else:
                        platforms_list = [platforms_raw]
            elif isinstance(platforms_raw, dict):
                # Handle FormData array notation like platforms[0]=facebook
                platforms_list = [str(v) for k, v in sorted(platforms_raw.items(), key=lambda x: int(x[0]) if x[0].isdigit() else 0)]
            elif isinstance(platforms_raw, (list, tuple)):
                # Handle list - could be ['["facebook"]'] from QueryDict or ['facebook']
                for item in platforms_raw:
                    if isinstance(item, str):
                        try:
                            parsed = json.loads(item)
                            if isinstance(parsed, list):
                                platforms_list.extend([str(p) for p in parsed])
                            else:
                                platforms_list.append(str(parsed))
                        except (json.JSONDecodeError, TypeError):
                            platforms_list.append(item)
                    else:
                        platforms_list.append(str(item))

        data['platforms'] = platforms_list

        # Debug: Show final parsed platforms
        print(f"DEBUG: Final platforms: {data.get('platforms')}")

        serializer = CreatePostSerializer(data=data)
        if not serializer.is_valid():
            print(f"Validation Error: {serializer.errors}")
            # Try to force it for debugging if needed, but let's see if this cleaning works
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Handle file uploads - match Django template pattern
        import os
        import time
        from django.conf import settings

        media_files = []
        file_idx = 0
        print(f"DEBUG FILES: request.FILES keys = {list(request.FILES.keys())}")
        print(f"DEBUG FILES: request.content_type = {request.content_type}")
        for key in sorted(request.FILES.keys()):
            if key.startswith('media_'):
                uploaded_file = request.FILES[key]

                # Validate size (50MB max)
                max_size = 50 * 1024 * 1024
                if uploaded_file.size > max_size:
                    continue

                # Get extension
                ext = os.path.splitext(uploaded_file.name)[1].lower()

                # Validate file type
                allowed_types = ['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.mov', '.avi']
                if ext not in allowed_types:
                    continue

                # Create unique filename with timestamp
                timestamp = time.time()
                filename = f"{int(timestamp)}_{file_idx}{ext}"

                # Create user-specific directory
                user_dir = os.path.join('posts', str(request.user.id))
                full_dir = os.path.join(settings.MEDIA_ROOT, user_dir)
                os.makedirs(full_dir, exist_ok=True)

                # Save file
                file_path = os.path.join(user_dir, filename)
                full_path = os.path.join(settings.MEDIA_ROOT, file_path)

                # Write file
                with open(full_path, 'wb+') as destination:
                    for chunk in uploaded_file.chunks():
                        destination.write(chunk)

                # Store path WITHOUT /media/ prefix (scheduler expects this format).
                # Normalize to forward slashes — on Windows os.path.join yields
                # backslashes, which then break the media URL in the browser.
                media_files.append(file_path.replace('\\', '/'))
                file_idx += 1

        # Attach already-generated media (AI image/video) by reference. Magic
        # Link/Mode generates the media server-side first, so re-uploading it
        # from the browser is fragile (the video flow aborts the whole draft if
        # the client re-fetch fails; the image flow sent a URL the backend
        # ignored). Accept owned media paths / a video generation id instead.
        media_paths_raw = request.data.get('media_paths')
        if isinstance(media_paths_raw, str):
            try:
                parsed = json.loads(media_paths_raw)
                media_paths_raw = parsed if isinstance(parsed, list) else [parsed]
            except (json.JSONDecodeError, TypeError):
                media_paths_raw = [media_paths_raw]
        elif not isinstance(media_paths_raw, (list, tuple)):
            media_paths_raw = [] if media_paths_raw is None else [media_paths_raw]

        for rel in _resolve_owned_media_paths(
            request.user, media_paths_raw, request.data.get('video_generation_id')
        ):
            if rel not in media_files:
                media_files.append(rel)

        # Validate connected accounts for non-draft posts
        post_status = serializer.validated_data.get('status', 'scheduled')
        if post_status != 'draft':
            from platforms.models import SocialAccount
            connected = set(
                SocialAccount.objects.filter(
                    user=request.user, is_active=True
                ).values_list('platform', flat=True)
            )
            missing = [p for p in serializer.validated_data['platforms'] if p not in connected]
            if missing:
                return Response(
                    {'error': f'No connected account for: {", ".join(missing)}. Please connect your accounts first.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        print(f"DEBUG FILES: Saving post with media_files = {media_files}")
        post = Post.objects.create(
            user=request.user,
            caption=serializer.validated_data['caption'],
            platforms=json.dumps(serializer.validated_data['platforms']),
            scheduled_time=serializer.validated_data.get('scheduled_time'),
            timezone=serializer.validated_data.get('timezone', 'UTC'),
            media_files=json.dumps(media_files),
            status=post_status,
            source=serializer.validated_data.get('source', 'manual'),
            hook=serializer.validated_data.get('hook', ''),
        )
        print(f"DEBUG FILES: Post #{post.id} created, media_files in DB = {repr(post.media_files)}")

        return Response(PostSerializer(post, context={'request': request}).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        post = self.get_object()

        if post.status not in ['draft', 'scheduled']:
            return Response(
                {'error': 'Cannot edit a post that has been posted or is posting'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = UpdatePostSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        new_status = serializer.validated_data.get('status')
        target_status = new_status if new_status else post.status

        # Validate connected accounts when transitioning to scheduled
        if target_status == 'scheduled' and post.status == 'draft':
            from platforms.models import SocialAccount
            connected = set(
                SocialAccount.objects.filter(
                    user=request.user, is_active=True
                ).values_list('platform', flat=True)
            )
            try:
                current_platforms = json.loads(post.platforms) if isinstance(post.platforms, str) else (post.platforms or [])
            except (json.JSONDecodeError, TypeError):
                current_platforms = []
            platforms_to_check = serializer.validated_data.get('platforms', current_platforms)
            missing = [p for p in platforms_to_check if p not in connected]
            if missing:
                return Response(
                    {'error': f'No connected account for: {", ".join(missing)}. Please connect your accounts first.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        if 'caption' in serializer.validated_data:
            post.caption = serializer.validated_data['caption']
        if 'platforms' in serializer.validated_data:
            post.platforms = json.dumps(serializer.validated_data['platforms'])
        if 'scheduled_time' in serializer.validated_data:
            post.scheduled_time = serializer.validated_data['scheduled_time']
        if 'timezone' in serializer.validated_data:
            post.timezone = serializer.validated_data['timezone']
        if new_status:
            post.status = new_status

        post.save()
        return Response(PostSerializer(post, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a scheduled post"""
        post = self.get_object()

        if post.status in ('posted', 'cancelled'):
            return Response(
                {'error': f'Cannot cancel a post with status "{post.status}"'},
                status=status.HTTP_400_BAD_REQUEST
            )

        post.status = 'cancelled'
        post.save()
        return Response(PostSerializer(post, context={'request': request}).data)


# ===================== PLATFORMS VIEWS =====================

@method_decorator(csrf_exempt, name='dispatch')
class SocialAccountViewSet(viewsets.ModelViewSet):
    """ViewSet for SocialAccount CRUD operations"""
    serializer_class = SocialAccountSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return SocialAccount.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def validate(self, request, pk=None):
        """Validate social account credentials"""
        account = self.get_object()

        # Call platform-specific validation
        # This would be implemented based on the platform
        # For now, return success
        return Response({'valid': True})


# ===================== AI CAPTION VIEWS =====================

def _parse_bool(value, default=True):
    """Parse boolean from form data (comes as string 'true'/'false')"""
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.lower() in ('true', '1', 'yes')
    return default


def _build_caption_brand_context(user, brand_id=None, idea=None, trending_topics=None, video_prompt=None):
    """Assemble a brand / idea / trending / video context block for caption
    generation.

    Mirrors the context the video & image prompt builders already use
    (posts/services/visual_prompt_builder.py) so a caption written for an AI
    video reflects the same brand DNA, creative idea and the *actual* video
    prompt — instead of being generated from the raw seed topic alone, which is
    why captions diverged from the videos. Returned as a text block that gets
    appended to the caption's custom_instructions, so the caption service
    signature is unchanged.
    """
    import json as _json
    lines = []

    dna = {}
    if brand_id:
        try:
            from brands.models import Brand
            brand = Brand.objects.filter(id=int(brand_id), user=user).first()
            if brand:
                dna = brand.brand_dna or {}
        except (ValueError, TypeError):
            dna = {}

    def _f(key):
        val = dna.get(key) if isinstance(dna, dict) else None
        if isinstance(val, (list, tuple)):
            val = ', '.join(str(v) for v in val if v)
        return str(val).strip() if val else ''

    brand_bits = []
    for label, key in (
        ('name', 'brand_name'), ('voice', 'brand_voice'),
        ('values', 'brand_values'), ('audience', 'target_audience'),
        ('cta_style', 'cta_style'),
    ):
        v = _f(key)
        if v:
            brand_bits.append(f"  {label}: {v}")
    if brand_bits:
        lines.append("<brand>\n" + "\n".join(brand_bits) + "\n</brand>")

    if isinstance(idea, str):
        try:
            idea = _json.loads(idea)
        except (ValueError, TypeError):
            idea = None
    if isinstance(idea, dict):
        idea_bits = [f"  {k}: {str(idea.get(k)).strip()}"
                     for k in ('title', 'hook', 'angle') if idea.get(k)]
        if idea_bits:
            lines.append("<creative_idea>\n" + "\n".join(idea_bits) + "\n</creative_idea>")

    if isinstance(trending_topics, str):
        try:
            trending_topics = _json.loads(trending_topics)
        except (ValueError, TypeError):
            trending_topics = None
    if isinstance(trending_topics, (list, tuple)):
        themes = [str(t).strip() for t in trending_topics if t]
        if themes:
            lines.append("<trending_themes>\n  " + "\n  ".join(themes) + "\n</trending_themes>")

    if video_prompt and str(video_prompt).strip():
        lines.append("<video_prompt>\n  " + str(video_prompt).strip()[:1200] + "\n</video_prompt>")

    if not lines:
        return ''

    return (
        "Use the brand identity, creative idea and the video described below so the "
        "caption matches the actual video and the brand's voice (do NOT just describe "
        "the video):\n" + "\n".join(lines)
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_caption(request):
    """Generate AI caption - mirrors the working Django template view logic"""
    try:
        import tempfile
        import os
        from ai_caption.openai_service import CaptionGeneratorService
        from ai_caption.models import CaptionGeneration as CaptionGen, UserAPISettings as CaptionAPISettings

        # Diamond Token check
        gate = diamond_gate(request.user, 'caption')
        if gate:
            return gate

        # Check if AI service is available (Claude key from env)
        claude_key = get_claude_key()
        if not claude_key:
            return Response(
                {'error': 'AI service not configured. Contact admin.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Parse form data
        input_text = request.data.get('input_text', '') or request.data.get('topic', '')
        media_file = request.FILES.get('media_file')
        tone = request.data.get('tone', 'professional')
        length = request.data.get('length', 'medium')
        platform = request.data.get('platform', 'general')
        include_hashtags = _parse_bool(request.data.get('include_hashtags', True))
        include_emojis = _parse_bool(request.data.get('include_emojis', True))
        include_cta = _parse_bool(request.data.get('include_cta', False))
        custom_instructions = request.data.get('custom_instructions', '')
        override_prompt = request.data.get('override_prompt', '')

        # Enrich the caption with the same brand DNA / idea / trending / video
        # prompt context the video itself was built from, so the caption matches
        # the video instead of being generated from the raw topic alone.
        brand_context = _build_caption_brand_context(
            user=request.user,
            brand_id=request.data.get('brand_id'),
            idea=request.data.get('idea'),
            trending_topics=request.data.get('trending_topics'),
            video_prompt=request.data.get('video_prompt'),
        )
        if brand_context:
            custom_instructions = (
                f"{custom_instructions}\n\n{brand_context}".strip()
                if custom_instructions else brand_context
            )

        if not input_text and not media_file:
            return Response(
                {'error': 'Please provide text or a media file.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Determine media type
        media_type = 'none'
        if media_file:
            ext = media_file.name.lower().split('.')[-1]
            if ext in ('jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'):
                media_type = 'image'
            elif ext in ('mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'm4v'):
                media_type = 'video'

        # Create CaptionGeneration DB record
        caption_gen = CaptionGen.objects.create(
            user=request.user,
            input_text=input_text,
            media_type=media_type,
            tone=tone,
            length=length,
            platform=platform,
            include_hashtags=include_hashtags,
            include_emojis=include_emojis,
            include_cta=include_cta,
            custom_instructions=custom_instructions,
            status='processing'
        )

        # Save media file if provided
        if media_file:
            caption_gen.media_file = media_file
            caption_gen.save()

        # Get or create user API settings for usage tracking
        api_settings, _ = CaptionAPISettings.objects.get_or_create(user=request.user)

        # Initialize service with Claude as primary provider
        service = CaptionGeneratorService(user=request.user)

        # Generate based on media type (same logic as Django template view)
        if media_type == 'image':
            result = service.generate_from_image(
                image_path=caption_gen.media_file.path,
                additional_context=input_text,
                tone=tone,
                length=length,
                platform=platform,
                include_hashtags=include_hashtags,
                include_emojis=include_emojis,
                include_cta=include_cta,
                custom_instructions=custom_instructions,
                override_prompt=override_prompt or None,
            )
        elif media_type == 'video':
            result = service.generate_from_video(
                video_path=caption_gen.media_file.path,
                additional_context=input_text,
                tone=tone,
                length=length,
                platform=platform,
                include_hashtags=include_hashtags,
                include_emojis=include_emojis,
                include_cta=include_cta,
                custom_instructions=custom_instructions,
                override_prompt=override_prompt or None,
            )
        else:
            result = service.generate_from_text(
                topic=input_text,
                tone=tone,
                length=length,
                platform=platform,
                include_hashtags=include_hashtags,
                include_emojis=include_emojis,
                include_cta=include_cta,
                custom_instructions=custom_instructions,
                override_prompt=override_prompt or None,
            )

        if result.get('success'):
            caption_gen.generated_caption = result['caption']
            caption_gen.generated_hashtags = result.get('hashtags', '')
            caption_gen.media_analysis = result.get('analysis', '')
            caption_gen.tokens_used = result.get('tokens_used', 0)
            caption_gen.processing_time = result.get('processing_time', 0)
            caption_gen.model_used = result.get('model_used', 'gpt-4o')
            caption_gen.status = 'completed'

            # Update usage stats
            api_settings.total_tokens_used += result.get('tokens_used', 0)
            api_settings.total_generations += 1
            api_settings.save()

            # Deduct Diamond Tokens (auto-extracts provider/model/tokens from result dict)
            deduct_diamonds(user=request.user, feature='caption', result=result)
        else:
            caption_gen.status = 'failed'
            caption_gen.error_message = result.get('error', 'Unknown error')

        caption_gen.save()

        if caption_gen.status == 'failed':
            return Response(
                {'error': caption_gen.error_message},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # Return serialized CaptionGeneration object + used_prompt + provider
        response_data = CaptionGenerationSerializer(caption_gen).data
        response_data['provider'] = result.get('provider', 'claude')
        if result.get('used_prompt'):
            response_data['used_prompt'] = result['used_prompt']
        return Response(response_data)

    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def regenerate_caption(request, pk):
    """Regenerate caption with feedback"""
    try:
        from ai_caption.openai_service import CaptionGeneratorService
        from ai_caption.models import CaptionGeneration

        # Diamond Token check
        gate = diamond_gate(request.user, 'caption_regenerate')
        if gate:
            return gate

        caption_gen = CaptionGeneration.objects.filter(pk=pk, user=request.user).first()
        if not caption_gen:
            return Response(
                {'error': 'Caption not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        feedback = request.data.get('feedback', '')
        tone = request.data.get('tone', caption_gen.tone)

        if not feedback:
            return Response(
                {'error': 'Please provide feedback for regeneration.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        service = CaptionGeneratorService(user=request.user)

        result = service.regenerate_with_feedback(
            original_caption=caption_gen.generated_caption,
            feedback=feedback,
            tone=tone,
            platform=caption_gen.platform,
            include_hashtags=caption_gen.include_hashtags,
            include_emojis=caption_gen.include_emojis,
            include_cta=caption_gen.include_cta
        )

        if result.get('success'):
            # Update the record
            caption_gen.generated_caption = result['caption']
            caption_gen.generated_hashtags = result.get('hashtags', '')
            caption_gen.tokens_used += result.get('tokens_used', 0)
            caption_gen.save()

            # Deduct Diamond Tokens (auto-extracts provider/model/tokens from result dict)
            deduct_diamonds(user=request.user, feature='caption_regenerate', result=result)

            return Response({
                'success': True,
                'caption': result['caption'],
                'hashtags': result.get('hashtags', ''),
                'id': caption_gen.id,
            })
        else:
            return Response(
                {'error': result.get('error', 'Unknown error')},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# ===================== USER PROFILE VIEWS =====================

class UserProfileView(generics.RetrieveUpdateAPIView):
    """Get and update user profile with all details"""
    serializer_class = UserDetailSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        user = self.get_object()
        serializer = UpdateProfileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Update User fields
        if 'first_name' in data:
            user.first_name = data['first_name']
        if 'last_name' in data:
            user.last_name = data['last_name']
        if 'email' in data:
            user.email = data['email']
        user.save()

        # Update Profile fields
        profile = user.profile
        if 'phone' in data:
            profile.phone = data['phone']
        if 'company' in data:
            profile.company = data['company']
        profile.save()

        return Response(UserDetailSerializer(user).data)


class GlobalAPIKeysView(APIView):
    """API key status and Diamond Token balance for users.
    API keys are now admin-managed globally — users cannot set keys.
    Users see their Diamond Token balance and AI service status."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        openai_key = get_openai_key(request.user)
        gemini_key = get_gemini_key(request.user)
        claude_key = get_claude_key(request.user)

        # Diamond wallet balance
        from accounts.models import DiamondWallet
        wallet, _ = DiamondWallet.objects.get_or_create(user=request.user)

        return Response({
            'has_openai_key': bool(openai_key),
            'has_gemini_key': bool(gemini_key),
            'claude_active': bool(claude_key),
            'diamond_balance': wallet.balance,
            'diamond_total_recharged': wallet.total_recharged,
            'diamond_total_spent': wallet.total_spent,
        })


# ===================== EXTENDED PLATFORM VIEWS =====================

@method_decorator(csrf_exempt, name='dispatch')
class SocialAccountDetailViewSet(viewsets.ModelViewSet):
    """ViewSet for SocialAccount with full credential management"""
    serializer_class = SocialAccountDetailSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return SocialAccount.objects.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        """Override create to handle update_or_create behavior similar to Django views"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        platform = serializer.validated_data.get('platform')
        
        # Check if user can add more accounts (if it's a new account)
        existing_account = SocialAccount.objects.filter(user=request.user, platform=platform).first()
        if not existing_account and not request.user.profile.can_add_account():
            return Response(
                {'error': f'You have reached your account limit ({request.user.profile.max_social_accounts})'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Extract all credential fields from validated data
        defaults = {k: v for k, v in serializer.validated_data.items() if k != 'platform'}
        if not defaults.get('account_name'):
            defaults['account_name'] = f"{platform.title()} Account"
        
        defaults['status'] = 'pending_validation'
        defaults['is_validated'] = False
        defaults['is_active'] = True

        # Update or create based on user and platform
        account, created = SocialAccount.objects.update_or_create(
            user=request.user,
            platform=platform,
            defaults=defaults
        )

        # Run validation immediately
        try:
            is_valid = False
            account_name = account.account_name or f"{platform.title()} Account"
            
            if platform == 'facebook' or platform == 'messenger':
                from platforms.services.facebook import FacebookService
                is_valid, result = FacebookService.validate_credentials(account.facebook_page_id, account.facebook_access_token)
                if is_valid: account_name = result
            elif platform == 'twitter':
                from platforms.services.twitter import TwitterService
                is_valid, result = TwitterService.validate_credentials(
                    account.twitter_api_key, account.twitter_api_secret,
                    account.twitter_access_token, account.twitter_access_token_secret
                )
                if is_valid: account_name = result
            elif platform == 'instagram':
                from platforms.services.instagram import InstagramService
                is_valid, result = InstagramService.validate_credentials(account.instagram_access_token, account.instagram_business_account_id)
                if is_valid: account_name = result
            elif platform == 'linkedin':
                from platforms.services.linkedin import LinkedInService
                is_valid, result = LinkedInService.validate_credentials(account.linkedin_access_token, account.linkedin_person_urn)
                if is_valid: account_name = result
            else:
                is_valid = True # Default valid for others

            account.is_validated = is_valid
            account.account_name = account_name
            account.status = 'active' if is_valid else 'invalid'
            account.last_validated_at = timezone.now()
            account.save()

            # Sync with MessengerConnection if platform is messenger
            if platform == 'messenger' and is_valid:
                from accounts.utils import is_messenger_enabled
                if is_messenger_enabled():
                    _page_id    = account.facebook_page_id
                    _page_name  = account_name
                    _page_token = account.facebook_access_token
                    try:
                        conn = MessengerConnection.objects.get(page_id=_page_id)
                        conn.user              = request.user
                        conn.page_name         = _page_name
                        conn.page_access_token = _page_token
                        conn.is_active         = True
                        conn.save(update_fields=['user_id', 'page_name', 'page_access_token', 'is_active'])
                    except MessengerConnection.DoesNotExist:
                        conn, _ = MessengerConnection.objects.update_or_create(
                            user=request.user,
                            defaults={
                                'page_id':            _page_id,
                                'page_name':          _page_name,
                                'page_access_token':  _page_token,
                                'is_active':          True,
                            }
                        )
                    AIConfiguration.objects.get_or_create(connection=conn)

            if not is_valid:
                return Response({'error': f'Validation failed for {platform}'}, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            account.status = 'invalid'
            account.validation_error = str(e)
            account.save()
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        response_serializer = self.get_serializer(account)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def validate_credentials(self, request, pk=None):
        """Validate platform credentials"""
        account = self.get_object()
        platform = account.platform

        # Import platform-specific validation
        try:
            if platform == 'facebook':
                from platforms.services.facebook import FacebookService
                is_valid, result = FacebookService.validate_credentials(account.facebook_page_id, account.facebook_access_token)
                if is_valid: account.account_name = result
            elif platform == 'twitter':
                from platforms.services.twitter import TwitterService
                is_valid, result = TwitterService.validate_credentials(
                    account.twitter_api_key,
                    account.twitter_api_secret,
                    account.twitter_access_token,
                    account.twitter_access_token_secret
                )
                if is_valid: account.account_name = result
            elif platform == 'instagram':
                from platforms.services.instagram import InstagramService
                is_valid, result = InstagramService.validate_credentials(account.instagram_access_token, account.instagram_business_account_id)
                if is_valid: account.account_name = result
            elif platform == 'linkedin':
                from platforms.services.linkedin import LinkedInService
                is_valid, result = LinkedInService.validate_credentials(account.linkedin_access_token, account.linkedin_person_urn)
                if is_valid: account.account_name = result
            else:
                is_valid = True  # Assume valid for platforms without validation

            account.is_validated = is_valid
            account.last_validated_at = timezone.now()
            account.validation_error = None if is_valid else 'Validation failed'
            account.status = 'active' if is_valid else 'invalid'
            account.save()

            return Response({
                'valid': is_valid,
                'message': 'Credentials validated successfully' if is_valid else 'Validation failed'
            })
        except Exception as e:
            account.is_validated = False
            account.validation_error = str(e)
            account.status = 'invalid'
            account.save()
            return Response({
                'valid': False,
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)


# ===================== AI CAPTION EXTENDED VIEWS =====================

class CaptionHistoryView(generics.ListAPIView):
    """Get user's caption generation history"""
    serializer_class = CaptionGenerationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return CaptionGeneration.objects.filter(user=self.request.user).order_by('-created_at')


class CaptionTemplateViewSet(viewsets.ModelViewSet):
    """ViewSet for caption templates"""
    serializer_class = CaptionTemplateSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Return user's templates and global templates
        return CaptionTemplate.objects.filter(
            Q(user=self.request.user) | Q(is_global=True)
        ).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user, is_global=False)


class SavedCaptionViewSet(viewsets.ModelViewSet):
    """ViewSet for saved captions"""
    serializer_class = SavedCaptionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return SavedCaption.objects.filter(user=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class CaptionAPISettingsView(generics.RetrieveUpdateAPIView):
    """Get and update caption API settings"""
    serializer_class = UserAPISettingsSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        obj, _ = UserAPISettings.objects.get_or_create(user=self.request.user)
        return obj


# ===================== AI IMAGE VIEWS =====================

class ImageSettingsView(generics.RetrieveUpdateAPIView):
    """Get and update image generation settings"""
    serializer_class = UserImageSettingsSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        obj, _ = UserImageSettings.objects.get_or_create(user=self.request.user)
        return obj


class UserLogoViewSet(viewsets.ModelViewSet):
    """ViewSet for user logos"""
    serializer_class = UserLogoSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        return UserLogo.objects.filter(user=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        # If this is set as default, unset others
        if serializer.validated_data.get('is_default', False):
            UserLogo.objects.filter(user=self.request.user, is_default=True).update(is_default=False)
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def set_default(self, request, pk=None):
        """Set logo as default"""
        logo = self.get_object()
        UserLogo.objects.filter(user=request.user, is_default=True).update(is_default=False)
        logo.is_default = True
        logo.save()
        return Response(UserLogoSerializer(logo).data)


class ImageGenerationHistoryView(generics.ListAPIView):
    """Get user's image generation history"""
    serializer_class = ImageGenerationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ImageGeneration.objects.filter(user=self.request.user).order_by('-created_at')


class SavedImageViewSet(viewsets.ModelViewSet):
    """ViewSet for saved images"""
    serializer_class = SavedImageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return SavedImage.objects.filter(user=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class ImagePromptTemplateViewSet(viewsets.ModelViewSet):
    """ViewSet for image prompt templates"""
    serializer_class = PromptTemplateSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return PromptTemplate.objects.filter(
            Q(user=self.request.user) | Q(is_global=True)
        ).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user, is_global=False)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def refine_image_prompt(request):
    """Use LLM to refine raw context into a focused image generation prompt."""
    try:
        # Diamond Token check
        gate = diamond_gate(request.user, 'refine_prompt')
        if gate:
            return gate

        service = get_llm_service(request.user)

        brand_name = request.data.get('brand_name', '')
        industry = request.data.get('industry', '')
        description = request.data.get('description', '')
        target_audience = request.data.get('target_audience', '')
        ideas = request.data.get('ideas', [])
        topics = request.data.get('topics', [])
        caption_snippet = request.data.get('caption_snippet', '')
        user_prompt = request.data.get('user_prompt', '')
        style = request.data.get('style', '')
        override_prompt = request.data.get('override_prompt', '')
        think_harder = request.data.get('think_harder', False)

        if not user_prompt:
            return Response(
                {'error': 'user_prompt is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        system_message = (
            "You are an expert at crafting concise image generation prompts for social media posts. "
            "Your job is to take messy raw context and the user's direction, then output ONE clean, "
            "focused image prompt (2-3 sentences max).\n\n"
            "CRITICAL RULES:\n"
            "1. ADAPT to the industry. A SaaS brand needs abstract/conceptual visuals (dashboards, "
            "clean UI mockups, workspace scenes, abstract tech graphics). A fashion brand needs "
            "lifestyle/product shots. A food brand needs appetizing plating. NEVER default to "
            "fashion-show or runway imagery unless the brand is literally a fashion brand.\n"
            "2. Focus on what the user asked for in their direction — that is the PRIMARY intent. "
            "Use the brand context only to set the right tone, color palette, and mood.\n"
            "3. Keep it simple and literal. Describe a single clear scene. No collages, no split "
            "screens, no multiple concepts crammed together.\n"
            "4. Do NOT request text/words/logos in the image. Do NOT add people unless the user "
            "or context specifically calls for them.\n"
            "5. Return ONLY the refined prompt. No explanations, no labels, no quotation marks."
        )

        context_parts = []
        if brand_name:
            context_parts.append(f"Brand: {brand_name}")
        if industry:
            context_parts.append(f"Industry: {industry}")
        if description:
            context_parts.append(f"Brand description: {description}")
        if target_audience:
            context_parts.append(f"Target audience: {target_audience}")
        if ideas:
            context_parts.append(f"Content ideas being used: {', '.join(ideas[:3])}")
        if topics:
            context_parts.append(f"Trending topics for context: {', '.join(topics[:3])}")
        if caption_snippet:
            context_parts.append(f"Caption snippet: {caption_snippet[:150]}")
        if style:
            context_parts.append(f"Preferred visual style: {style}")

        context_block = "\n".join(context_parts)
        user_message = (
            f"Brand context:\n{context_block}\n\n"
            f"User's image direction: {user_prompt}\n\n"
            "Generate a clean, focused image prompt that matches this brand's industry and the user's direction."
        )

        # Per-user admin override of the image-refiner system prompt
        import time as _time_ir
        from accounts.services.prompt_resolver import (
            resolve_prompt as _ir_resolve, save_execution as _ir_save_exec,
        )
        system_message, _ir_was_override = _ir_resolve(
            request.user, 'image_refiner', system_message,
            {'context_block': context_block, 'user_prompt': user_prompt},
            return_meta=True,
        )

        if override_prompt:
            user_message = override_prompt

        _t0 = _time_ir.monotonic()
        result = service.chat_completion(
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message},
            ],
            temperature=0.7,
            max_tokens=600 if think_harder else 300,
            thinking_budget=10000 if think_harder else 0,
        )
        _ir_latency_ms = int((_time_ir.monotonic() - _t0) * 1000)

        _ir_save_exec(
            request.user, 'image_refiner',
            f"SYSTEM:\n{system_message}\n\nUSER:\n{user_message}",
            response_received=(result.content if result.success else ''),
            was_override=_ir_was_override,
            model_used=getattr(result, 'model', ''),
            tokens_in=getattr(result, 'input_tokens', 0),
            tokens_out=getattr(result, 'output_tokens', 0),
            latency_ms=_ir_latency_ms, success=result.success,
            error_message=result.error or '',
        )

        if not result.success:
            return Response({'error': result.error}, status=status.HTTP_400_BAD_REQUEST)
        refined_prompt = result.content.strip()

        # Deduct Diamond Tokens (auto-extracts provider/model/tokens from LLMResponse)
        deduct_diamonds(user=request.user, feature='refine_prompt', result=result)

        return Response({'refined_prompt': refined_prompt, 'used_prompt': f"SYSTEM:\n{system_message}\n\nUSER:\n{user_message}"})

    except Exception as e:
        logger.error(f"Prompt refinement failed: {e}")
        return Response(
            {'error': f'Prompt refinement failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_image(request):
    """Generate AI image - mirrors the working Django template view"""
    import uuid
    from django.core.files.base import ContentFile
    from ai_image.image_service import ImageService
    import logging
    logger = logging.getLogger(__name__)

    try:
        # Diamond Token check
        gate = diamond_gate(request.user, 'image', quality=request.data.get('quality', 'standard'))
        if gate:
            return gate

        img_settings, _ = UserImageSettings.objects.get_or_create(user=request.user)

        # Centralized key lookup
        openai_key = get_openai_key(request.user)
        gemini_key = get_gemini_key(request.user)

        if not openai_key and not gemini_key:
            return Response(
                {'error': 'Please set your API key first in Settings.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Parse form data
        title = request.data.get('title', 'Untitled Image')
        prompt = request.data.get('prompt', '')
        negative_prompt = request.data.get('negative_prompt', '')
        style = request.data.get('style', 'realistic')
        size = request.data.get('size', '1024x1024')
        quality = request.data.get('quality', 'high')

        if not prompt:
            return Response(
                {'error': 'Prompt is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Provider selection with centralized key fallback
        provider = request.data.get('provider', img_settings.default_provider)
        model = request.data.get('model', '')

        if provider == 'openai' and not openai_key:
            if gemini_key:
                provider = 'gemini'
            else:
                return Response({'error': 'OpenAI API key not configured.'}, status=status.HTTP_400_BAD_REQUEST)
        elif provider == 'gemini' and not gemini_key:
            if openai_key:
                provider = 'openai'
            else:
                return Response({'error': 'Gemini API key not configured.'}, status=status.HTTP_400_BAD_REQUEST)

        # Logo settings (new: brand_logo_id from BrandAsset; legacy: logo_id from UserLogo)
        brand_logo_id = request.data.get('brand_logo_id')
        logo_id = request.data.get('logo_id')
        logo_position = request.data.get('logo_position', 'bottom_right')
        logo_size = int(request.data.get('logo_size', 10))
        logo_opacity = int(request.data.get('logo_opacity', 100))

        # With Copy feature
        with_copy = _parse_bool(request.data.get('with_copy', 'false'))
        copy_text = (request.data.get('copy_text', '') or '').strip()

        # Product settings
        product_file = request.FILES.get('product_image')
        product_position = request.data.get('product_position', 'center')
        product_scale = int(request.data.get('product_scale', 50))

        # Advanced options
        enhance = _parse_bool(request.data.get('enhance_prompt', 'true'))
        lighting = request.data.get('add_lighting', '') or request.data.get('lighting', '')
        camera_angle = request.data.get('camera_angle', '')

        # Resolve brand logo (BrandAsset) — preferred over legacy UserLogo
        from brands.models import BrandAsset, Brand as BrandModel
        brand_logo_obj = None
        brand_primary_logo_path = None  # fallback from Brand.logo field
        if brand_logo_id:
            if str(brand_logo_id) == '-1':
                # Sentinel: use brand's primary logo field
                brand = BrandModel.objects.filter(user=request.user).first()
                if brand and brand.logo:
                    brand_primary_logo_path = brand.logo.path
            else:
                try:
                    brand_logo_obj = BrandAsset.objects.get(pk=brand_logo_id, asset_type='logo')
                except BrandAsset.DoesNotExist:
                    pass

        # Legacy UserLogo fallback
        logo = None
        if not brand_logo_obj and not brand_primary_logo_path and logo_id and logo_position != 'none':
            try:
                logo = UserLogo.objects.get(pk=logo_id, user=request.user)
            except UserLogo.DoesNotExist:
                pass

        # Link to post if post_id provided
        linked_post = None
        post_id = request.data.get('post_id')
        if post_id:
            try:
                linked_post = Post.objects.get(id=int(post_id), user=request.user)
            except (Post.DoesNotExist, ValueError, TypeError):
                pass

        # Create generation record
        generation = ImageGeneration.objects.create(
            user=request.user,
            post=linked_post,
            provider=provider,
            title=title,
            prompt=prompt,
            negative_prompt=negative_prompt,
            style=style,
            size=size,
            quality=quality,
            logo=logo,
            brand_logo=brand_logo_obj,
            logo_position=logo_position,
            logo_size=logo_size,
            logo_opacity=logo_opacity,
            enhance_prompt=enhance,
            add_lighting=lighting,
            camera_angle=camera_angle,
            product_position=product_position,
            product_scale=product_scale,
            with_copy=with_copy,
            copy_text_in_image=copy_text if with_copy else '',
            status='processing'
        )

        # Save product image if uploaded
        has_product = False
        product_image_data = None
        if product_file:
            generation.product_image = product_file
            generation.save()
            has_product = True
            generation.product_image.seek(0)
            product_image_data = generation.product_image.read()

        # Modify prompt for product compositing
        gen_prompt = prompt
        gen_negative = negative_prompt
        if has_product:
            try:
                from ai_image.product_compositor import enhance_product_prompt, get_product_negative_prompt
                gen_prompt = enhance_product_prompt(prompt)
                gen_negative = get_product_negative_prompt(negative_prompt)
            except ImportError:
                pass

        # 9-layer prompt engineering via Claude (if brand available + enhance enabled)
        brand = None
        brand_id = request.data.get('brand_id')
        if brand_id:
            try:
                brand = Brand.objects.get(id=int(brand_id), user=request.user)
            except (Brand.DoesNotExist, ValueError, TypeError):
                pass
        if not brand:
            brand = Brand.objects.filter(user=request.user, is_primary=True).first()

        if brand and enhance and brand.brand_dna:
            try:
                from ai_image.services.prompt_engineering_service import ImagePromptEngineerService
                pe_service = ImagePromptEngineerService()
                platform = request.data.get('platform', 'instagram')
                pe_result = pe_service.generate_image_prompt(
                    brand=brand,
                    content_context={
                        'subject': gen_prompt,
                        'key_message': '',
                        'mood': style,
                        'must_include': [],
                        'must_exclude': [x.strip() for x in (gen_negative or '').split(',') if x.strip()],
                        'text_overlay_position': request.data.get('text_overlay_position', ''),
                    },
                    platform=platform,
                    user=request.user,
                )
                if pe_result and pe_result.get('primary_prompt'):
                    gen_prompt = pe_result['primary_prompt']
                    generation.brand_style_anchor = pe_result.get('brand_style_anchor', '')
                    generation.prompt_engineering_used = True
                    generation.save()
            except Exception as pe_err:
                import logging
                logging.getLogger(__name__).warning(f"Prompt engineering skipped: {pe_err}")

        # Modify prompt based on with_copy flag
        if with_copy and copy_text:
            gen_prompt += (
                f'\n\nIMPORTANT: This image MUST prominently feature the following marketing copy '
                f'text rendered artistically as part of the composition: "{copy_text}". '
                f'The text should be professionally designed, clearly readable, and integrated '
                f'into the visual layout like a graphic designer would create. '
                f'Think of this as a social media marketing graphic with text baked into the design.'
            )
        else:
            gen_prompt += (
                '\n\nCRITICAL REQUIREMENT: Do NOT include any text, typography, words, letters, '
                'numbers, watermarks, or any written characters in this image. '
                'The image must be purely visual with absolutely zero text elements.'
            )
            if gen_negative:
                gen_negative += ', text, typography, words, letters, watermark'
            else:
                gen_negative = 'text, typography, words, letters, watermark'

        # Get image service with centralized API keys
        service = ImageService(
            provider=provider,
            openai_key=openai_key,
            gemini_key=gemini_key
        )

        # Determine logo path for compositing
        active_logo_path = None
        if brand_logo_obj and brand_logo_obj.file:
            active_logo_path = brand_logo_obj.file.path
        elif brand_primary_logo_path:
            active_logo_path = brand_primary_logo_path
        elif logo and logo.logo_file:
            active_logo_path = logo.logo_file.path

        def _generate_and_process(gen_record, prompt_text, variation_label=''):
            """Generate a single image, composite product & logo, update record."""
            result = service.generate_image(
                prompt=prompt_text,
                style=style,
                size=size,
                quality=quality,
                negative_prompt=gen_negative,
                lighting=lighting if lighting else None,
                camera_angle=camera_angle if camera_angle else None,
                enhance=enhance,
                model=model if model else None
            )

            # If generation fails, return error immediately (no fallback)
            if not result.get('success'):
                gen_record.status = 'failed'
                gen_record.error_message = result.get('error', 'Unknown error')
                gen_record.save()
                return result

            image_data = result['image_data']
            filename = f"{uuid.uuid4().hex}.png"
            gen_record.generated_image.save(filename, ContentFile(image_data))

            # Product compositing
            final_image_data = image_data
            if has_product and product_image_data:
                try:
                    from ai_image.product_compositor import ProductCompositor
                    compositor = ProductCompositor(remove_bg=True)
                    composited_data = compositor.composite_product(
                        scene_image_data=image_data,
                        product_image_data=product_image_data,
                        position=product_position,
                        scale=product_scale,
                        add_shadow=True
                    )
                    comp_filename = f"{uuid.uuid4().hex}_composited.png"
                    gen_record.composited_image.save(comp_filename, ContentFile(composited_data))
                    final_image_data = composited_data
                except Exception:
                    pass

            # Mandatory logo compositing
            if active_logo_path:
                try:
                    image_with_logo = service.add_logo_to_image(
                        image_data=final_image_data,
                        logo_path=active_logo_path,
                        position=logo_position,
                        size_percent=logo_size,
                        opacity=logo_opacity
                    )
                    logo_filename = f"{uuid.uuid4().hex}_logo.png"
                    gen_record.generated_image_with_logo.save(logo_filename, ContentFile(image_with_logo))
                except Exception as e:
                    logger.error(f"Logo compositing failed for gen {gen_record.id}: {e} (path={active_logo_path}, pos={logo_position})")

            gen_record.enhanced_prompt = result.get('enhanced_prompt', '')
            gen_record.revised_prompt = result.get('revised_prompt', '')
            gen_record.model_used = result.get('model_used', '')
            gen_record.processing_time = result.get('processing_time', 0)
            gen_record.status = 'completed'
            gen_record.save()
            return result

        # Generate image(s)
        if with_copy and copy_text:
            # Variation 1: bold centered layout
            prompt_v1 = gen_prompt + '\nUse a bold, centered layout for the text with visual elements surrounding it.'
            # Variation 2: asymmetric layout
            prompt_v2 = gen_prompt + '\nUse an asymmetric layout with text on one side and visual focus on the other.'

            result1 = _generate_and_process(generation, prompt_v1, 'Variation 1')

            # Create second generation record for variation 2
            generation2 = ImageGeneration.objects.create(
                user=request.user,
                post=linked_post,
                provider=provider,
                title=title,
                prompt=prompt,
                negative_prompt=negative_prompt,
                style=style,
                size=size,
                quality=quality,
                logo=logo,
                brand_logo=brand_logo_obj,
                logo_position=logo_position,
                logo_size=logo_size,
                logo_opacity=logo_opacity,
                enhance_prompt=enhance,
                add_lighting=lighting,
                camera_angle=camera_angle,
                product_position=product_position,
                product_scale=product_scale,
                with_copy=True,
                copy_text_in_image=copy_text,
                status='processing'
            )
            # Save product image to second record too
            if product_file:
                generation.product_image.seek(0)
                generation2.product_image.save(product_file.name, ContentFile(generation.product_image.read()))

            result2 = _generate_and_process(generation2, prompt_v2, 'Variation 2')

            # Link siblings
            generation.sibling_generation = generation2
            generation.save(update_fields=['sibling_generation'])
            generation2.sibling_generation = generation
            generation2.save(update_fields=['sibling_generation'])

            # Deduct diamonds for both — captures actual model + count
            for res in [result1, result2]:
                if res.get('success'):
                    deduct_diamonds(
                        user=request.user, feature='image', result=res,
                        media_count=1,
                    )

            # Update usage stats (2 images)
            successful = sum(1 for r in [result1, result2] if r.get('success'))
            img_settings.total_images_generated += successful
            img_settings.total_api_calls += 2
            if provider == 'openai':
                img_settings.openai_images_generated += successful
            else:
                img_settings.gemini_images_generated += successful
            img_settings.save()

            if linked_post:
                linked_post.update_checklist()
                notify_images_ready(linked_post)

            # Build response with images array
            resp_data = ImageGenerationSerializer(generation, context={'request': request}).data
            resp_data['with_copy'] = True
            resp_data['copy_text'] = copy_text
            images_arr = []
            for g in [generation, generation2]:
                display = g.get_display_image()
                images_arr.append({
                    'generation_id': g.id,
                    'image_url': request.build_absolute_uri(display.url) if display else None,
                })
            resp_data['images'] = images_arr
            return Response(resp_data)
        else:
            # Standard single-image generation
            result = _generate_and_process(generation, gen_prompt)

            if result.get('success'):
                if linked_post:
                    linked_post.update_checklist()
                    notify_images_ready(linked_post)

                img_settings.total_images_generated += 1
                img_settings.total_api_calls += 1
                if provider == 'openai':
                    img_settings.openai_images_generated += 1
                else:
                    img_settings.gemini_images_generated += 1
                img_settings.save()

                deduct_diamonds(user=request.user, feature='image', result=result, media_count=1)

                return Response(ImageGenerationSerializer(generation, context={'request': request}).data)
            else:
                return Response(
                    {'error': result.get('error', 'Failed to generate image')},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# ===================== ONBOARDING VIEWS =====================

class OnboardingProgressView(generics.RetrieveUpdateAPIView):
    """Get and update onboarding progress"""
    serializer_class = OnboardingProgressSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        obj, _ = OnboardingProgress.objects.get_or_create(user=self.request.user)
        return obj


class OnboardingStepView(APIView):
    """Complete a specific onboarding step"""
    permission_classes = [IsAuthenticated]

    def post(self, request, step_number):
        progress, _ = OnboardingProgress.objects.get_or_create(user=request.user)

        if step_number < 1 or step_number > 7:
            return Response({'error': 'Invalid step number'}, status=status.HTTP_400_BAD_REQUEST)

        progress.mark_step_completed(step_number)
        return Response(OnboardingProgressSerializer(progress).data)


class OnboardingSkipView(APIView):
    """Skip the onboarding flow"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        progress, _ = OnboardingProgress.objects.get_or_create(user=request.user)
        progress.skip_onboarding()
        return Response(OnboardingProgressSerializer(progress).data)


# ===================== WORKSPACE VIEWS =====================

class WorkspaceViewSet(viewsets.ModelViewSet):
    """ViewSet for Workspace CRUD"""
    serializer_class = WorkspaceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Workspace.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        workspace = serializer.save(owner=self.request.user)

        # Assign 'owner' role to user in their workspace (CRITICAL for RBAC permissions)
        UserRole.objects.create(
            user=self.request.user,
            workspace=workspace,
            role='owner',
            granted_by=self.request.user
        )

        # Mark onboarding step 1 complete if user is in onboarding
        try:
            from onboarding.models import OnboardingProgress
            progress, _ = OnboardingProgress.objects.get_or_create(user=self.request.user)
            if progress.needs_onboarding and 1 not in progress.completed_steps:
                progress.mark_step_completed(1)
        except Exception:
            pass  # Don't fail workspace creation if onboarding update fails

        return workspace


# ===================== BRAND VIEWS =====================

class BrandViewSet(viewsets.ModelViewSet):
    """ViewSet for Brand CRUD"""
    serializer_class = BrandSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        queryset = Brand.objects.filter(user=self.request.user)
        workspace_id = self.request.query_params.get('workspace')
        if workspace_id:
            queryset = queryset.filter(workspace_id=workspace_id)
        return queryset

    def perform_create(self, serializer):
        brand = serializer.save(user=self.request.user)

        # Mark onboarding step 2 complete (don't auto-skip — user must finish all steps)
        try:
            from onboarding.models import OnboardingProgress
            progress, _ = OnboardingProgress.objects.get_or_create(user=self.request.user)
            if progress.needs_onboarding and 2 not in progress.completed_steps:
                progress.mark_step_completed(2)
        except Exception:
            pass  # Don't fail brand creation if onboarding update fails

        return brand

    @action(detail=True, methods=['post'])
    def set_primary(self, request, pk=None):
        """Set this brand as primary"""
        brand = self.get_object()
        Brand.objects.filter(workspace=brand.workspace).update(is_primary=False)
        brand.is_primary = True
        brand.save()
        return Response(BrandSerializer(brand).data)


class BrandAssetViewSet(viewsets.ModelViewSet):
    """ViewSet for BrandAsset CRUD"""
    serializer_class = BrandAssetSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    pagination_class = None

    def get_queryset(self):
        qs = BrandAsset.objects.filter(brand__user=self.request.user)
        brand_id = self.request.query_params.get('brand')
        if brand_id:
            qs = qs.filter(brand_id=brand_id)
        return qs


class LaunchPlanView(generics.RetrieveUpdateAPIView):
    """Get/update launch plan for a brand"""
    serializer_class = LaunchPlanSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        brand_id = self.kwargs.get('brand_id')
        brand = Brand.objects.get(id=brand_id, user=self.request.user)
        obj, _ = LaunchPlan.objects.get_or_create(brand=brand)
        return obj


class CreateLaunchPlanView(generics.CreateAPIView):
    """Create launch plan for a brand"""
    serializer_class = LaunchPlanSerializer
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        brand_id = request.data.get('brand')
        try:
            brand = Brand.objects.get(id=brand_id, user=request.user)
        except Brand.DoesNotExist:
            return Response({'error': 'Brand not found'}, status=status.HTTP_404_NOT_FOUND)

        plan, created = LaunchPlan.objects.update_or_create(
            brand=brand,
            defaults={
                'post_frequency': request.data.get('post_frequency', 3),
                'formats_allowed': request.data.get('formats_allowed', []),
                'variant_generation_level': request.data.get('variant_generation_level', 'medium'),
                'approval_required': request.data.get('approval_required', True),
            }
        )
        return Response(
            LaunchPlanSerializer(plan).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )


# ===================== CONTENT IDEA VIEWS =====================

class ContentIdeaViewSet(viewsets.ModelViewSet):
    """ViewSet for ContentIdea CRUD"""
    serializer_class = ContentIdeaDetailSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = ContentIdea.objects.filter(user=self.request.user)
        brand_id = self.request.query_params.get('brand')
        if brand_id:
            queryset = queryset.filter(brand_id=brand_id)
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        platform = self.request.query_params.get('platform')
        if platform:
            queryset = queryset.filter(platform=platform)
        return queryset

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def save_idea(self, request, pk=None):
        """Mark idea as saved"""
        idea = self.get_object()
        idea.status = 'saved'
        idea.save()
        return Response(ContentIdeaSerializer(idea).data)

    @action(detail=True, methods=['post'])
    def skip_idea(self, request, pk=None):
        """Mark idea as skipped"""
        idea = self.get_object()
        idea.status = 'skipped'
        idea.save()
        return Response(ContentIdeaSerializer(idea).data)

    @action(detail=True, methods=['post'])
    def convert_to_draft(self, request, pk=None):
        """Convert idea to a draft post"""
        idea = self.get_object()

        # Create a post from the idea
        post = Post.objects.create(
            user=request.user,
            caption=f"{idea.title}\n\n{idea.hook}",
            platforms=json.dumps([idea.platform] if idea.platform else []),
            scheduled_time=timezone.now() + timedelta(days=1),
            status='draft',
            ai_generated=True,
        )

        idea.status = 'drafted'
        idea.post = post
        idea.save()

        return Response({
            'idea': ContentIdeaSerializer(idea).data,
            'post': PostSerializer(post, context={'request': request}).data,
        })


# ===================== CONTENT APPROVAL VIEWS =====================

class ContentApprovalViewSet(viewsets.ModelViewSet):
    """ViewSet for ContentApproval management"""
    serializer_class = ContentApprovalSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = ContentApproval.objects.filter(
            Q(submitted_by=self.request.user) | Q(approver=self.request.user)
        )
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset

    def perform_create(self, serializer):
        post_id = serializer.validated_data.get('post').id
        post = Post.objects.get(id=post_id, user=self.request.user)
        post.status = 'pending_approval'
        post.save()
        serializer.save(submitted_by=self.request.user)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a content submission"""
        approval = self.get_object()
        approval.status = 'approved'
        approval.approver = request.user
        approval.reviewed_at = timezone.now()
        approval.comments = request.data.get('comments', '')
        approval.save()

        # Update post status
        approval.post.status = 'approved'
        approval.post.save()

        return Response(ContentApprovalSerializer(approval).data)

    @action(detail=True, methods=['post'])
    def request_changes(self, request, pk=None):
        """Request changes on a submission"""
        approval = self.get_object()
        approval.status = 'changes_requested'
        approval.approver = request.user
        approval.reviewed_at = timezone.now()
        approval.comments = request.data.get('comments', '')
        approval.save()

        approval.post.status = 'changes_requested'
        approval.post.save()

        return Response(ContentApprovalSerializer(approval).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject a content submission"""
        approval = self.get_object()
        approval.status = 'rejected'
        approval.approver = request.user
        approval.reviewed_at = timezone.now()
        approval.rejection_reason = request.data.get('rejection_reason', '')
        approval.save()

        approval.post.status = 'rejected'
        approval.post.save()

        return Response(ContentApprovalSerializer(approval).data)


# ===================== WEEKLY REPORT & USAGE VIEWS =====================

class WeeklyReportViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for WeeklyReport (read-only)"""
    serializer_class = WeeklyReportSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return WeeklyReport.objects.filter(brand__user=self.request.user)


class GenerationUsageView(APIView):
    """Get generation usage for the user's workspace"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        workspace_id = request.query_params.get('workspace')
        days = int(request.query_params.get('days', 30))
        start_date = timezone.now().date() - timedelta(days=days)

        queryset = GenerationUsage.objects.filter(
            workspace__owner=request.user,
            date__gte=start_date,
        )
        if workspace_id:
            queryset = queryset.filter(workspace_id=workspace_id)

        usage = queryset.values('generation_type').annotate(
            total=Sum('count')
        )

        return Response(list(usage))


# ===================== BRAND DNA VIEWS =====================


def build_structured_dna(brand_name, industry, target_region, voice_tone='professional',
                         products_services=None, website_url=''):
    """Build a 15-field DNA JSON from structured inputs (no AI call, instant)."""
    products = products_services or []
    return {
        'brand_name': brand_name,
        'tagline': '',
        'industry': industry,
        'description': f'{brand_name} is a {industry} brand targeting {target_region}.',
        'products_services': products,
        'target_audience': f'Audiences in {target_region} interested in {industry}',
        'unique_selling_points': [],
        'brand_voice': voice_tone,
        'brand_values': [],
        'color_theme': [],
        'content_themes': [industry.lower()] if industry else [],
        'cta_style': 'Learn more',
        'social_platforms': [],
        'keywords': [kw for kw in [brand_name.lower(), industry.lower()] if kw],
        'competitor_positioning': '',
        'website_url': website_url,
    }


class GenerateBrandDNAView(APIView):
    """Generate Brand DNA by reading the brand's website with AI"""
    permission_classes = [IsAuthenticated]

    def post(self, request, brand_id):
        try:
            brand = Brand.objects.get(
                Q(user=request.user) | Q(workspace__owner=request.user),
                id=brand_id
            )
        except Brand.DoesNotExist:
            return Response({'error': 'Brand not found'}, status=status.HTTP_404_NOT_FOUND)

        # Diamond Token check
        gate = diamond_gate(request.user, 'brand_dna')
        if gate:
            return gate

        # Accept website_url from POST body
        website_url = request.data.get('website_url', '').strip()
        if website_url:
            # Only save if URL actually changed (avoid unnecessary DB writes)
            if brand.website_url != website_url:
                brand.website_url = website_url
                # Use safe_model_save with retry logic for SQLite concurrency
                safe_model_save(brand, update_fields=['website_url'])
        elif not brand.website_url:
            return Response(
                {'error': 'Please provide your website URL.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        service = get_llm_service(request.user)

        override_prompt = request.data.get('override_prompt', '')

        try:
            url = brand.website_url

            prompt = f"""<task>
Research the brand at the URL below using the web_search tool, then extract a
complete 15-field Brand DNA profile from what you find.
</task>

<target>
Website URL: {url}
</target>

<research_instructions>
1. Use the web_search tool to read multiple pages of this brand's website:
   homepage, About / Story, Services or Products, Pricing, and any blog or
   press / news pages you can find.
2. Run 2-5 searches. Start with `site:{url}` style queries to enumerate the
   site's own pages; follow up with targeted queries like "<brand-name>
   mission", "<brand-name> founder", "<brand-name> reviews", or "<brand-name>
   vs <competitor>" when useful.
3. Synthesise across pages — do NOT base the DNA on a single page.
4. If the site is unreachable, return JSON with an "error" key explaining why.
</research_instructions>

<output_fields>
| # | Field | What to extract |
|---|-------|-----------------|
| 1 | brand_name | Official brand name as displayed |
| 2 | tagline | Primary tagline or slogan |
| 3 | industry | Industry vertical and sub-category |
| 4 | description | 2-3 sentence brand description |
| 5 | products_services | Specific offerings listed |
| 6 | target_audience | Who the brand is speaking to (demographics + psychographics) |
| 7 | unique_selling_points | 3-5 specific differentiators |
| 8 | brand_voice | Detailed voice description (not just "professional") |
| 9 | brand_values | Core values demonstrated through content |
| 10 | color_theme | Dominant colors observed on the site |
| 11 | content_themes | Recurring topics and themes in the content |
| 12 | cta_style | How the brand asks for action (aggressive, soft, value-led, etc.) |
| 13 | social_platforms | Any social media links or mentions found |
| 14 | keywords | 10-15 high-relevance keywords for content creation |
| 15 | competitor_positioning | How the brand positions itself vs. alternatives |
</output_fields>

<output_format>
Return ONLY a single JSON object with all 15 fields as keys.
</output_format>

<constraints>
- All 15 fields are required — leave none empty.
- Be specific and detailed — generic answers reduce strategic value.
- Base everything on actual content you find via web_search.
- Return valid JSON only.
</constraints>"""

            # Per-user admin override of brand_dna_website prompt
            import time as _time
            from accounts.services.prompt_resolver import (
                resolve_prompt as _resolve_dna, save_execution as _save_dna_exec,
            )
            prompt, _dna_was_override = _resolve_dna(
                request.user, 'brand_dna_website', prompt,
                {'url': url},
                return_meta=True,
            )
            if override_prompt:
                prompt = override_prompt

            _dna_system = 'You are a senior brand strategist who extracts comprehensive brand identity profiles by researching brand websites live. You combine analytical precision with strategic intuition to build Brand DNA profiles that power content creation.\n\nYour approach:\n- You use the web_search tool to read actual brand pages — homepage, about, services, blog — instead of guessing\n- You read website copy the way a strategist reads — looking for positioning, messaging hierarchy, value propositions, and audience signals\n- You distinguish between what a brand SAYS and what it MEANS\n- You extract implicit signals (tone of voice from writing style, target audience from language choices, values from what they emphasize)\n- You are specific and detailed — "professional" is not a useful brand voice description; "authoritative but approachable, uses industry jargon sparingly, favors short sentences and active voice" IS\n\nCRITICAL: Base ALL analysis on actual content surfaced through web_search. Clearly distinguish between directly stated facts and reasonable inferences.\n\nReturn ONLY valid JSON — no markdown, no commentary.'
            _t0 = _time.monotonic()
            result = service.chat_completion(
                messages=[
                    {'role': 'system', 'content': _dna_system},
                    {'role': 'user', 'content': prompt},
                ],
                temperature=0.3,
                max_tokens=8000,
                thinking_budget=10000,
                tools=[{
                    'type': 'web_search_20250305',
                    'name': 'web_search',
                    'max_uses': 5,
                }],
            )
            _latency_ms = int((_time.monotonic() - _t0) * 1000)

            _save_dna_exec(
                request.user, 'brand_dna_website',
                f"SYSTEM:\n{_dna_system}\n\nUSER:\n{prompt}",
                response_received=(result.content if result.success else ''),
                was_override=_dna_was_override,
                model_used=getattr(result, 'model', ''),
                tokens_in=getattr(result, 'input_tokens', 0),
                tokens_out=getattr(result, 'output_tokens', 0),
                latency_ms=_latency_ms, success=result.success,
                error_message=result.error or '',
                brand=brand,
            )

            if not result.success:
                return Response({'error': result.error}, status=status.HTTP_400_BAD_REQUEST)

            dna_data = extract_json_object(result.content)

            # Normalize array fields — LLM may return strings instead of arrays
            _array_fields = [
                'products_services', 'unique_selling_points', 'brand_values',
                'content_themes', 'keywords', 'color_theme', 'social_platforms',
            ]
            for _field in _array_fields:
                val = dna_data.get(_field)
                if isinstance(val, str) and val:
                    dna_data[_field] = [item.strip() for item in val.split(',') if item.strip()]
                elif not isinstance(val, list):
                    dna_data[_field] = []

            # Save to brand
            dna_data['website_url'] = url
            # `page_title` used to come from the BS4 scrape; now we surface
            # the brand_name the LLM extracted via web_search, falling back
            # to the URL if it's missing.
            dna_data['page_title'] = dna_data.get('brand_name') or url
            brand.brand_dna = dna_data
            brand.brand_dna_generated_at = timezone.now()
            brand.brand_dna_source = 'website'
            brand.save(update_fields=['brand_dna', 'brand_dna_generated_at', 'brand_dna_source'])

            # V1.3 — Save to DNA history
            from brands.models import BrandDNAHistory
            BrandDNAHistory.objects.filter(brand=brand).update(is_active=False)
            BrandDNAHistory.objects.create(
                brand=brand,
                dna_data=dna_data,
                website_url=url,
                source='website',
                is_active=True,
            )

            # Save prompt to history
            from brands.models import PromptHistory
            PromptHistory.save_prompt(brand, 'brand_dna', prompt)

            # Deduct Diamond Tokens (auto-extracts provider/model/tokens from LLMResponse)
            deduct_diamonds(user=request.user, feature='brand_dna', result=result)

            return Response({
                'success': True,
                'brand_dna': dna_data,
                'generated_at': brand.brand_dna_generated_at.isoformat(),
                'message': 'Brand DNA generated successfully from your website!',
                'used_prompt': prompt,
                'provider': getattr(result, 'provider', 'claude'),
                'model_used': getattr(result, 'model', ''),
            })

        except json.JSONDecodeError:
            logger.error(
                'Brand DNA parse failure (brand=%s, finish_reason=%s): %.500s',
                brand_id, getattr(result, 'finish_reason', ''),
                getattr(result, 'content', ''),
            )
            return Response({'error': 'Failed to parse AI response'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response(
                {'error': f'Brand DNA generation failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class BrandDNAStatusView(APIView):
    """Get Brand DNA generation status and stats"""
    permission_classes = [IsAuthenticated]

    def get(self, request, brand_id):
        try:
            brand = Brand.objects.get(id=brand_id, user=request.user)
        except Brand.DoesNotExist:
            return Response({'error': 'Brand not found'}, status=status.HTTP_404_NOT_FOUND)

        chunk_count = BrandDNAChunk.objects.filter(brand=brand).count()

        return Response({
            'brand_id': brand.id,
            'brand_name': brand.brand_name,
            'website_url': brand.website_url or '',
            'brand_dna': brand.brand_dna or {},
            'brand_dna_generated_at': brand.brand_dna_generated_at,
            'brand_dna_source': brand.brand_dna_source or '',
            'total_chunks': chunk_count,
        })


class RegenerateBrandDNAFromInputsView(APIView):
    """Accept all 15 DNA fields as editable inputs, optionally AI-enhance them."""
    permission_classes = [IsAuthenticated]

    def post(self, request, brand_id):
        try:
            brand = Brand.objects.get(
                Q(user=request.user) | Q(workspace__owner=request.user),
                id=brand_id
            )
        except Brand.DoesNotExist:
            return Response({'error': 'Brand not found'}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        use_ai = data.get('use_ai', False)

        # Build the DNA from inputs (15 built-in fields)
        BUILTIN_KEYS = {
            'brand_name', 'tagline', 'industry', 'description', 'products_services',
            'target_audience', 'unique_selling_points', 'brand_voice', 'brand_values',
            'color_theme', 'content_themes', 'cta_style', 'social_platforms', 'keywords',
            'competitor_positioning', 'website_url',
        }
        SKIP_KEYS = {'use_ai', 'target_region', 'csrfmiddlewaretoken'}

        dna_data = {
            'brand_name': data.get('brand_name', brand.brand_name or ''),
            'tagline': data.get('tagline', ''),
            'industry': data.get('industry', brand.industry or ''),
            'description': data.get('description', ''),
            'products_services': data.get('products_services', []),
            'target_audience': data.get('target_audience', ''),
            'unique_selling_points': data.get('unique_selling_points', []),
            'brand_voice': data.get('brand_voice', brand.voice_tone or 'professional'),
            'brand_values': data.get('brand_values', []),
            'color_theme': data.get('color_theme', []),
            'content_themes': data.get('content_themes', []),
            'cta_style': data.get('cta_style', ''),
            'social_platforms': data.get('social_platforms', []),
            'keywords': data.get('keywords', []),
            'competitor_positioning': data.get('competitor_positioning', ''),
            'website_url': data.get('website_url', brand.website_url or ''),
        }

        # Include any custom fields from the request
        for key, val in data.items():
            if key not in BUILTIN_KEYS and key not in SKIP_KEYS:
                dna_data[key] = val

        # Update the Brand model fields too
        brand.brand_name = dna_data['brand_name'] or brand.brand_name
        brand.industry = dna_data['industry'] or brand.industry
        brand.voice_tone = dna_data['brand_voice'] or brand.voice_tone
        brand.website_url = dna_data['website_url'] or brand.website_url
        if data.get('target_region'):
            brand.target_region = data['target_region']

        source = 'manual'
        used_prompt = ''
        override_prompt = request.data.get('override_prompt', '')
        think_harder = request.data.get('think_harder', False)

        if use_ai:
            service = get_llm_service(request.user)
            try:
                prompt = f"""<task>
Enhance and complete this Brand DNA profile. Keep user-provided values but make them richer, more specific, and fill any empty fields with reasonable defaults.
</task>

<current_dna>
{json.dumps(dna_data, indent=2)}
</current_dna>

<instructions>
For each of the 15 fields:
1. If populated: Enhance specificity and strategic usefulness while preserving intent.
2. If empty: Infer a reasonable value from the other fields. For example, if industry is "SaaS" and audience is "small businesses," brand_voice might reasonably be "approachable, clear, jargon-light, solution-focused."
3. Ensure all fields are internally consistent with each other.
</instructions>

<output_format>
Return ONLY a single JSON object with all 15 Brand DNA fields.
</output_format>"""

                if override_prompt:
                    prompt = override_prompt
                used_prompt = prompt

                result = service.chat_completion(
                    messages=[
                        {'role': 'system', 'content': 'You are a brand strategist who polishes and completes Brand DNA profiles. You take user-provided brand information and make it richer, more specific, and more strategically actionable — while always preserving the user\'s original intent and voice.\n\nYour enhancements:\n- Transform vague descriptions into specific, usable strategic language\n- Fill empty fields with reasonable defaults inferred from filled fields\n- Ensure internal consistency (voice should match values, audience should match positioning)\n- Make every field useful for a content creator or social media manager\n\nReturn ONLY valid JSON — no markdown, no commentary.'},
                        {'role': 'user', 'content': prompt},
                    ],
                    temperature=0.3,
                    max_tokens=5000 if think_harder else 2500,
                    thinking_budget=10000 if think_harder else 0,
                )
                if not result.success:
                    return Response(
                        {'error': f'AI enhancement failed: {result.error}. Your manual inputs were NOT saved — please try again or save without AI.'},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )
                dna_data = extract_json_object(result.content)
                source = 'website'  # AI-enhanced
            except Exception as e:
                return Response(
                    {'error': f'AI enhancement failed: {str(e)}. Your manual inputs were NOT saved — please try again or save without AI.'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

        # Save DNA to brand
        dna_data['website_url'] = dna_data.get('website_url', '') or brand.website_url or ''
        brand.brand_dna = dna_data
        brand.brand_dna_generated_at = timezone.now()
        brand.brand_dna_source = source
        brand.save(update_fields=[
            'brand_name', 'industry', 'voice_tone', 'website_url', 'target_region',
            'brand_dna', 'brand_dna_generated_at', 'brand_dna_source',
        ])

        # Save to DNA history
        from brands.models import BrandDNAHistory
        BrandDNAHistory.objects.filter(brand=brand).update(is_active=False)
        BrandDNAHistory.objects.create(
            brand=brand,
            dna_data=dna_data,
            website_url=brand.website_url or '',
            source=source,
            is_active=True,
        )

        # Save prompt to history
        if used_prompt:
            from brands.models import PromptHistory
            PromptHistory.save_prompt(brand, 'brand_dna', used_prompt)

        return Response({
            'success': True,
            'brand_dna': dna_data,
            'generated_at': brand.brand_dna_generated_at.isoformat(),
            'source': source,
            'message': 'Brand DNA updated with AI enhancement!' if use_ai else 'Brand DNA saved successfully!',
            'used_prompt': used_prompt,
        })


# ===================== SUPPORT CHATBOT =====================

logger = logging.getLogger(__name__)

SUPPORT_SYSTEM_PROMPT = """You are the official AI support assistant for Sellanto — a powerful all-in-one social media management and AI content platform. You answer user questions accurately, concisely, and helpfully. Always be friendly and professional.

Here is everything you know about the platform:

## Platform Overview
Sellanto helps businesses manage multiple social media accounts, create AI-powered content, automate messaging, and track analytics — all from one dashboard.

## Connecting Social Media Accounts
Users can connect the following platforms from the "Connect Account" page (/platforms):

1. **Facebook Pages**: Requires a Facebook App with pages_manage_posts permission. Users enter their Page ID and a Page Access Token (long-lived). The token can be generated from the Facebook Graph API Explorer or via the Facebook Developer portal.

2. **Instagram Business**: Requires a Facebook-connected Instagram Business account. Users need the Instagram Business Account ID and a Page Access Token from the linked Facebook Page. Instagram posting works through the Facebook Graph API (content publishing endpoint).

3. **Twitter / X**: Uses OAuth 1.0a authentication. Users need to create a Twitter Developer App and enter: API Key, API Secret, Access Token, and Access Token Secret. These are found in the Twitter Developer Portal under "Keys and Tokens".

4. **LinkedIn**: Uses OAuth 2.0. Users enter their LinkedIn Person URN (like "urn:li:person:XXXX") and an Access Token. The token is obtained through LinkedIn's OAuth flow or the Developer Portal.

For ALL platforms: After entering credentials, click "Connect" to verify and save. The platform will test the connection. Connected accounts appear with a green status indicator.

## Creating & Scheduling Posts
From "Create Post" (/posts/create):
- Write post content or use AI Caption to generate it
- Select one or multiple connected social media accounts to post to
- Upload images or videos as media attachments
- Choose to "Post Now" (immediate) or "Schedule" for a future date/time
- Scheduled posts run automatically via a background scheduler
- View all posts in "My Posts" (/posts) — filter by status (published, scheduled, draft, failed)
- Edit or delete scheduled posts before they publish

## AI Caption Generator (/ai-caption)
- Powered by OpenAI GPT models
- Enter a topic, select tone (professional, casual, witty, inspirational, etc.)
- Choose target platform for optimized formatting
- Select caption length and language
- Optionally use or create reusable caption templates
- View caption history and save favorites
- Requires an OpenAI API key (set in Settings or admin-provided)

## AI Image Generator (/ai-image)
- Powered by Google Gemini AI
- Describe the image you want to generate
- Choose style, aspect ratio, and quality settings
- Optionally overlay your brand logo on generated images
- Upload and manage logos in the Logo Manager
- Create and reuse prompt templates
- Requires a Gemini API key

## AI Video Generator (/ai-video)
- Powered by Google Gemini AI
- Generate short videos from text descriptions
- Choose video style, duration, and aspect ratio
- Optionally overlay brand logo
- Manage logos and prompt templates
- Requires a Gemini API key

## AI Voice Generator (/ai-voice)
- Powered by OpenAI Text-to-Speech (TTS)
- Convert text into natural-sounding speech
- Choose from multiple voice models: Nova (female, friendly), Alloy (neutral), Echo (male, warm), Fable (British), Onyx (deep male), Shimmer (female, expressive)
- Select audio quality (standard or HD)
- Preview voices before generating
- Download generated audio files
- Requires an OpenAI API key

## Messenger Bot (/messenger)
Automate Facebook Messenger conversations with AI:

### Setup:
1. Create a Facebook App at developers.facebook.com
2. Add the Messenger product to the app
3. In Sellanto, go to Messenger Bot > Connections > Add Connection
4. Enter your Facebook Page ID, Page Name, and Page Access Token
5. A unique Webhook URL and Verify Token are generated automatically
6. Copy the Webhook URL and Verify Token into your Facebook App's Messenger webhook settings
7. Facebook will verify the webhook — status turns green when verified
8. Enable the connection to start auto-replying

### Features:
- **AI Responses**: Uses OpenAI GPT to generate intelligent replies
- **Knowledge Base**: Upload PDF documents — the bot uses RAG (Retrieval Augmented Generation) to answer questions based on your documents
- **Website Crawling**: Crawl your website to add its content to the knowledge base
- **Custom Prompts**: Create and activate custom system prompts to control bot personality/behavior
- **Image Understanding**: Bot can analyze images sent by customers (uses GPT-4 Vision)
- **Voice Messages**: Bot can transcribe voice messages (Whisper) and optionally reply with voice (TTS)
- **E-Commerce Integration**: Connect WooCommerce store — bot can recommend products, answer product questions, provide pricing and availability
- **Human Takeover**: Take over conversations manually when needed
- **Notifications**: Get alerts for important customer messages

### AI Configuration:
- Choose OpenAI model (GPT-4o, GPT-4o Mini, GPT-4 Turbo, GPT-3.5 Turbo)
- Adjust temperature (creativity), max tokens (response length)
- Enable/disable RAG, image understanding, voice features
- Configure embedding model for knowledge base

## Analytics (/analytics)
- View engagement metrics across all connected platforms
- Track post performance (likes, comments, shares, impressions)
- Platform comparison charts
- Trending analysis over time
- Top performing posts
- Export data for reporting

## Subscription Plans
- **Free**: Basic features, limited accounts and posts per month
- **Starter**: More accounts and posts, all AI tools
- **Pro**: Higher limits, priority support
- **Business**: Generous limits, advanced features
- **Enterprise**: Unlimited everything, dedicated support

Users can view their current plan and usage on the Dashboard or Profile page.

## API Key Setup
Users need API keys for AI features:
- **OpenAI API Key**: Required for AI Caption, AI Voice, and Messenger Bot
- **Gemini API Key**: Required for AI Image and AI Video

Setup options:
1. **Global Keys** (Settings > API Keys): Enter once, automatically synced to all features
2. **Per-Feature Keys**: Set keys individually in each AI tool's settings page
3. **Admin-Provided**: If the admin has configured keys, features work automatically without user setup

Get API keys:
- OpenAI: https://platform.openai.com/api-keys — create an account, go to API Keys, generate a new key starting with "sk-"
- Gemini: https://aistudio.google.com/apikey — sign in with Google, create an API key

## Settings (/settings)
- Theme toggle: Light / Dark / System (follows OS preference)
- Profile management
- Notification preferences

## Business Profile (/business-profile)
- Set up brand information for content consistency
- Brand DNA generation from website analysis
- Content ideas and approval workflows

## Help & Information
- About page (/about): Platform information and team
- Privacy Policy (/privacy): Data handling practices
- Terms of Service (/terms): Usage terms
- Help Center (/help): FAQ and support contact

---

IMPORTANT RULES:
- Only answer questions about the Sellanto platform and its features
- If asked about something unrelated, politely redirect to platform topics
- Provide step-by-step instructions when explaining how to do something
- If you don't know the exact answer, suggest checking the Help page or contacting support
- Keep responses concise but thorough
- Use markdown formatting for better readability"""


class SupportChatView(APIView):
    """AI Support Chatbot - answers platform questions using admin-provided OpenAI key + RAG knowledge"""
    permission_classes = [IsAuthenticated]

    def _get_rag_context(self, user_query):
        """Retrieve relevant knowledge from uploaded support documents"""
        try:
            from accounts.models import SupportDocument
            docs = SupportDocument.objects.filter(is_active=True).exclude(extracted_text='')

            if not docs.exists():
                return ''

            # Keyword-based retrieval: find documents with matching content
            query_words = set(user_query.lower().split())
            stop_words = {'how', 'to', 'the', 'a', 'an', 'is', 'are', 'what', 'do', 'i', 'my',
                          'can', 'in', 'on', 'for', 'and', 'or', 'of', 'it', 'this', 'that', 'with',
                          'me', 'tell', 'please', 'about', 'help', 'need', 'want', 'know'}
            keywords = query_words - stop_words

            if not keywords:
                keywords = query_words

            relevant_parts = []
            for doc in docs:
                text_lower = doc.extracted_text.lower()
                score = sum(1 for kw in keywords if kw in text_lower)
                if score > 0:
                    paragraphs = doc.extracted_text.split('\n\n')
                    for para in paragraphs:
                        para_lower = para.lower().strip()
                        if any(kw in para_lower for kw in keywords) and len(para.strip()) > 30:
                            relevant_parts.append(f"[From: {doc.title}]\n{para.strip()}")

            if relevant_parts:
                context = '\n\n'.join(relevant_parts[:10])
                if len(context) > 3000:
                    context = context[:3000] + '...'
                return context

        except Exception as e:
            logger.warning(f"RAG context retrieval error: {e}")

        return ''

    def post(self, request):
        messages = request.data.get('messages', [])
        think_harder = request.data.get('think_harder', False)
        if not messages:
            return Response(
                {'error': 'No messages provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Diamond Token check
        gate = diamond_gate(request.user, 'support_chat')
        if gate:
            return gate

        # Get LLM service: admin site config key first, then user's configured provider
        site_key = SiteConfiguration.get('support_chat_api_key', '')
        if site_key:
            service = UnifiedLLMService(openai_key=site_key, claude_key=get_claude_key())
        else:
            service = get_llm_service(request.user)

        try:
            # Get the latest user message for RAG retrieval
            latest_user_msg = ''
            for msg in reversed(messages):
                if msg.get('role') == 'user':
                    latest_user_msg = msg.get('content', '')
                    break

            # Get RAG context from uploaded knowledge documents
            rag_context = self._get_rag_context(latest_user_msg) if latest_user_msg else ''

            # Build system prompt with RAG context — allow admin override
            import time as _time
            from accounts.services.prompt_resolver import (
                resolve_prompt as _sup_resolve, save_execution as _sup_save_exec,
            )
            system_prompt = SUPPORT_SYSTEM_PROMPT
            system_prompt, _sup_was_override = _sup_resolve(
                request.user, 'support_chat', system_prompt, {}, return_meta=True,
            )
            if rag_context:
                system_prompt += f"\n\n---\n\n## Additional Knowledge Base\nUse the following information from our knowledge documents to provide more accurate answers:\n\n{rag_context}"

            # Build message list with system prompt
            api_messages = [{'role': 'system', 'content': system_prompt}]
            for msg in messages[-20:]:  # Keep last 20 messages for context window
                role = msg.get('role', 'user')
                content = msg.get('content', '')
                if role in ('user', 'assistant') and content:
                    api_messages.append({'role': role, 'content': content})

            _t0 = _time.monotonic()
            result = service.chat_completion(
                messages=api_messages,
                temperature=0.7,
                max_tokens=2000 if think_harder else 1000,
                thinking_budget=10000 if think_harder else 0,
            )
            _latency_ms = int((_time.monotonic() - _t0) * 1000)

            # Build prompt-sent snapshot (system + last user message for compactness)
            _last_user = latest_user_msg or '(no message)'
            _sup_save_exec(
                request.user, 'support_chat',
                f"SYSTEM:\n{system_prompt}\n\nUSER:\n{_last_user}",
                response_received=(result.content if result.success else ''),
                was_override=_sup_was_override,
                model_used=getattr(result, 'model', ''),
                tokens_in=getattr(result, 'input_tokens', 0),
                tokens_out=getattr(result, 'output_tokens', 0),
                latency_ms=_latency_ms, success=result.success,
                error_message=result.error or '',
            )

            if not result.success:
                return Response({'error': result.error}, status=status.HTTP_400_BAD_REQUEST)

            # Deduct Diamond Tokens
            deduct_diamonds(
                user=request.user, feature='support_chat',
                result=result,
            )

            return Response({
                'reply': result.content,
                'model': result.model,
            })

        except Exception as e:
            logger.error(f"Support chat error: {e}")
            return Response(
                {'error': 'Failed to generate response. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class TestClaudeAPIView(APIView):
    """Simple endpoint to verify Claude API connectivity."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            service = get_llm_service(request.user)
            result = service.chat_completion(
                messages=[
                    {"role": "user", "content": "Say 'Claude API is working!' in exactly those words."}
                ],
                temperature=0,
                max_tokens=50,
            )

            if not result.success:
                return Response({
                    'status': 'error',
                    'error': result.error,
                    'provider': 'claude',
                }, status=status.HTTP_400_BAD_REQUEST)

            return Response({
                'status': 'ok',
                'response': result.content,
                'model': result.model,
                'provider': result.provider,
                'tokens_used': result.tokens_used,
            })

        except Exception as e:
            logger.error(f"Claude API test failed: {e}")
            return Response({
                'status': 'error',
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ===================== MAGIC MODE HISTORY =====================

class MagicHistoryView(APIView):
    """Full audit trail of all Magic Mode sessions — captions, ideas, images, DNA, trending"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from brands.models import Brand, ContentIdea, TrendingCache, BrandDNAHistory, PromptHistory
        from posts.models import Post
        from ai_video.models import VideoGeneration

        user = request.user

        # Get user's brands
        brands = Brand.objects.filter(user=user).order_by('-created_at')
        brand_ids = list(brands.values_list('id', flat=True))

        # Fetch Magic Mode posts
        magic_posts = list(Post.objects.filter(user=user, source='magic').order_by('-created_at').values(
            'id', 'caption', 'media_files', 'platforms', 'status', 'scheduled_time',
            'hook', 'created_at', 'posted_at',
        )[:200])

        # Fetch all data ordered by newest first
        captions = list(CaptionGeneration.objects.filter(user=user).order_by('-created_at').values(
            'id', 'input_text', 'generated_caption', 'generated_hashtags', 'tone', 'platform',
            'tokens_used', 'processing_time', 'model_used', 'status', 'error_message',
            'custom_instructions', 'created_at',
        )[:200])

        images = list(ImageGeneration.objects.filter(user=user).order_by('-created_at').values(
            'id', 'title', 'prompt', 'enhanced_prompt', 'revised_prompt',
            'generated_image', 'generated_image_with_logo', 'composited_image',
            'provider', 'model_used', 'processing_time', 'status', 'error_message',
            'style', 'size', 'quality', 'created_at',
        )[:200])

        ideas = list(ContentIdea.objects.filter(user=user).order_by('-created_at').values(
            'id', 'title', 'hook', 'angle', 'platform', 'content_format',
            'goal', 'status', 'batch_id', 'source', 'trending_topic_ref', 'created_at',
        )[:200])

        trending = list(TrendingCache.objects.filter(brand_id__in=brand_ids).order_by('-fetched_at').values(
            'id', 'topic', 'volume_score', 'relevance_explanation', 'platform', 'region', 'fetched_at',
        )[:100])

        dna_history = list(BrandDNAHistory.objects.filter(brand_id__in=brand_ids).order_by('-generated_at').values(
            'id', 'brand_id', 'dna_data', 'website_url', 'source', 'is_active', 'generated_at',
        )[:50])

        prompt_history = list(PromptHistory.objects.filter(brand_id__in=brand_ids).order_by('-created_at').values(
            'id', 'brand_id', 'feature', 'prompt_text', 'created_at',
        )[:100])
        
        videos = list(VideoGeneration.objects.filter(user=user).order_by('-created_at').values(
            'id', 'title', 'prompt', 'style', 'duration', 'aspect_ratio',
            'generated_video', 'generated_video_with_logo', 'thumbnail',
            'status', 'error_message', 'created_at',
        )[:100])

        # Build brand name map
        brand_map = {b.id: b.brand_name for b in brands}

        # Group everything into sessions (10-minute windows based on caption/idea creation)
        # Collect all timestamps
        all_events = []
        for c in captions:
            all_events.append(('caption', c['created_at'], c))
        for img in images:
            all_events.append(('image', img['created_at'], img))
        for idea in ideas:
            all_events.append(('idea', idea['created_at'], idea))
        for t in trending:
            all_events.append(('trending', t['fetched_at'], t))
        for d in dna_history:
            all_events.append(('dna', d['generated_at'], d))
        for p in prompt_history:
            all_events.append(('prompt', p['created_at'], p))
        for v in videos:
            all_events.append(('video', v['created_at'], v))
        for post in magic_posts:
            all_events.append(('post', post['created_at'], post))

        # Sort by timestamp desc
        all_events.sort(key=lambda x: x[1] if x[1] else timezone.now(), reverse=True)

        # Cluster into sessions (15-min gap = new session)
        sessions = []
        current_session = None
        session_gap = timedelta(minutes=60)

        for event_type, ts, data in all_events:
            if ts is None:
                continue
            if current_session is None or (current_session['_last_ts'] - ts) > session_gap:
                current_session = {
                    'id': ts.isoformat(),
                    'date': ts.isoformat(),
                    'captions': [],
                    'images': [],
                    'videos': [],
                    'ideas': [],
                    'trending_topics': [],
                    'dna': None,
                    'prompts': [],
                    'posts': [],
                    '_last_ts': ts,
                }
                sessions.append(current_session)
            else:
                current_session['_last_ts'] = ts

            if event_type == 'caption':
                data['created_at'] = data['created_at'].isoformat() if data['created_at'] else None
                current_session['captions'].append(data)
            elif event_type == 'image':
                data['created_at'] = data['created_at'].isoformat() if data['created_at'] else None
                # Convert image fields to URLs
                for field in ('generated_image', 'generated_image_with_logo', 'composited_image'):
                    if data.get(field):
                        data[field] = request.build_absolute_uri('/media/' + str(data[field]))
                    else:
                        data[field] = None
                current_session['images'].append(data)
            elif event_type == 'idea':
                data['created_at'] = data['created_at'].isoformat() if data['created_at'] else None
                current_session['ideas'].append(data)
            elif event_type == 'trending':
                data['fetched_at'] = data['fetched_at'].isoformat() if data['fetched_at'] else None
                current_session['trending_topics'].append(data)
            elif event_type == 'dna':
                data['generated_at'] = data['generated_at'].isoformat() if data['generated_at'] else None
                data['brand_name'] = brand_map.get(data.get('brand_id'), '')
                if current_session['dna'] is None:
                    current_session['dna'] = data
            elif event_type == 'prompt':
                data['created_at'] = data['created_at'].isoformat() if data['created_at'] else None
                current_session['prompts'].append(data)
            elif event_type == 'video':
                data['created_at'] = data['created_at'].isoformat() if data['created_at'] else None
                # Convert video fields to URLs
                for field in ('generated_video', 'generated_video_with_logo'):
                    if data.get(field):
                        data[field] = request.build_absolute_uri('/media/' + str(data[field]))
                    else:
                        data[field] = None
                if data.get('thumbnail'):
                    data['thumbnail'] = request.build_absolute_uri('/media/' + str(data['thumbnail']))
                current_session['videos'].append(data)
            elif event_type == 'post':
                data['created_at'] = data['created_at'].isoformat() if data['created_at'] else None
                data['posted_at'] = data['posted_at'].isoformat() if data.get('posted_at') else None
                data['scheduled_time'] = data['scheduled_time'].isoformat() if data.get('scheduled_time') else None
                # Convert media files to URLs
                import json
                try:
                    media_list = json.loads(data.get('media_files', '[]'))
                    data['media_urls'] = [request.build_absolute_uri('/media/' + str(m)) for m in media_list]
                except:
                    data['media_urls'] = []
                # Parse platforms
                try:
                    data['platforms_list'] = json.loads(data.get('platforms', '[]'))
                except:
                    data['platforms_list'] = []
                current_session['posts'].append(data)

        # Add stats and clean up internal fields
        for s in sessions:
            s.pop('_last_ts', None)
            total_tokens = sum(c.get('tokens_used', 0) or 0 for c in s['captions'])
            total_time = (
                sum(c.get('processing_time', 0) or 0 for c in s['captions'])
                + sum(i.get('processing_time', 0) or 0 for i in s['images'])
                + sum(v.get('processing_time', 0) or 0 for v in s['videos'])
            )
            s['stats'] = {
                'total_captions': len(s['captions']),
                'total_images': len(s['images']),
                'total_videos': len(s['videos']),
                'total_ideas': len(s['ideas']),
                'total_trending': len(s['trending_topics']),
                'total_posts': len(s['posts']),
                'total_tokens': total_tokens,
                'total_time': round(total_time, 1),
            }
            # Brand name from DNA
            if s['dna']:
                s['brand_name'] = s['dna'].get('brand_name', '')
                s['website_url'] = s['dna'].get('website_url', '')
            else:
                s['brand_name'] = ''
                s['website_url'] = ''

        return Response({'sessions': sessions})


class MagicModeCachedPostsView(APIView):
    """
    GET /api/magic/posts/{industry}/{goal}/{tone}/{platforms}/{colors}/
    GET /api/magic/posts/{industry}/{goal}/{tone}/{platforms}/{colors}/{custom}/

    Look up cached Magic Mode posts based on answer combination.
    Returns posts if cache hit, empty response if cache miss.
    Custom parameter is optional for "Other" option custom text.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, industry, goal, tone, platforms, colors, custom=None, user_id=None):
        from posts.models import MagicModeCache, Post

        # Security check: Verify user_id matches authenticated user
        if user_id is not None and user_id != request.user.id:
            return Response({'error': 'Unauthorized access'}, status=403)

        # Build params_hash from URL parameters (include custom if provided)
        params_hash = f"{industry}/{goal}/{tone}/{platforms}/{colors}"
        if custom:
            params_hash += f"/{custom}"

        print(f"[MagicCache] Looking up cache for user {request.user.id} with params: {params_hash}")

        try:
            # Find cache entry
            cache_entry = MagicModeCache.objects.get(
                user=request.user,
                params_hash=params_hash
            )

            # Fetch the posts
            post_ids = cache_entry.post_ids
            if not post_ids:
                print(f"[MagicCache] Cache entry found but no post_ids")
                return Response({'posts': []})

            posts = Post.objects.filter(id__in=post_ids, user=request.user).order_by('-created_at')

            # Serialize posts
            serialized_posts = []
            for post in posts:
                # 🔧 Parse JSON TextField data for frontend compatibility
                platforms = post.platforms
                media_files = post.media_files

                # If stored as JSON string, parse to array
                if isinstance(platforms, str):
                    try:
                        platforms = json.loads(platforms) if platforms else []
                    except json.JSONDecodeError:
                        platforms = []

                if isinstance(media_files, str):
                    try:
                        media_files = json.loads(media_files) if media_files else []
                    except json.JSONDecodeError:
                        media_files = []

                serialized_posts.append({
                    'id': post.id,
                    'caption': post.caption,
                    'platforms': platforms,
                    'media_files': media_files,
                    'status': post.status,
                    'magic_draft_id': post.magic_draft_id,  # 🔗 Link to Draft post
                    'created_at': post.created_at.isoformat(),
                })

            print(f"[MagicCache] Cache HIT - Returning {len(serialized_posts)} posts")
            return Response({
                'cache_hit': True,
                'posts': serialized_posts,
                'cached_at': cache_entry.created_at.isoformat(),
            })

        except MagicModeCache.DoesNotExist:
            print(f"[MagicCache] Cache MISS - No entry found")
            return Response({
                'cache_hit': False,
                'posts': [],
            })
        except Exception as e:
            print(f"[MagicCache] Error: {e}")
            return Response({
                'cache_hit': False,
                'posts': [],
                'error': str(e)
            }, status=500)

    def post(self, request, industry, goal, tone, platforms, colors, custom=None, user_id=None):
        """Create/update cache entry for Magic Mode posts"""
        from posts.models import MagicModeCache, Post

        # Security check: Verify user_id matches authenticated user
        if user_id is not None and user_id != request.user.id:
            return Response({'error': 'Unauthorized access'}, status=403)

        # Build params_hash from URL parameters (include custom if provided)
        params_hash = f"{industry}/{goal}/{tone}/{platforms}/{colors}"
        if custom:
            params_hash += f"/{custom}"

        post_ids = request.data.get('post_ids', [])

        if not post_ids:
            return Response({'error': 'post_ids required'}, status=400)

        # 🔒 SECURITY FIX: Validate ALL post_ids belong to current user
        # Prevents malicious users from caching other users' posts
        owned_posts = Post.objects.filter(id__in=post_ids, user=request.user).values_list('id', flat=True)
        owned_post_ids = list(owned_posts)

        if len(owned_post_ids) != len(post_ids):
            # Some posts don't belong to this user
            invalid_ids = set(post_ids) - set(owned_post_ids)
            print(f"[MagicCache] ⚠️ SECURITY: User {request.user.id} attempted to cache posts they don't own: {invalid_ids}")
            return Response({
                'error': 'Unauthorized: Some post IDs do not belong to you',
                'invalid_ids': list(invalid_ids)
            }, status=403)

        print(f"[MagicCache] Saving cache for user {request.user.id} with params: {params_hash}, posts: {owned_post_ids}")

        try:
            # Create or update cache entry with validated post_ids
            cache_entry, created = MagicModeCache.objects.update_or_create(
                user=request.user,
                params_hash=params_hash,
                defaults={'post_ids': owned_post_ids}
            )

            action = "Created" if created else "Updated"
            print(f"[MagicCache] {action} cache entry")

            return Response({
                'success': True,
                'created': created,
                'post_count': len(post_ids),
            })

        except Exception as e:
            print(f"[MagicCache] Error saving cache: {e}")
            return Response({
                'success': False,
                'error': str(e)
            }, status=500)


# ═══════════════════════════════════════════════════════════════════════════════
# MESSENGER BOT VIEWS — gated by kill switch
# ═══════════════════════════════════════════════════════════════════════════════

from accounts.utils import is_messenger_enabled
from rest_framework.exceptions import PermissionDenied as DRFPermissionDenied


class MessengerGateMixin:
    """Kill switch mixin — blocks ALL processing when messenger is disabled.
    Runs in initial() so no DB queries, no serializers, nothing executes."""
    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not is_messenger_enabled():
            raise DRFPermissionDenied('Messenger feature is currently disabled by admin.')


class MessengerConnectionViewSet(MessengerGateMixin, viewsets.ModelViewSet):
    serializer_class = MessengerConnectionSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return MessengerConnection.objects.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        try:
            existing = MessengerConnection.objects.get(user=request.user)
            serializer = self.get_serializer(existing, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            connection = serializer.save()
            base_url = request.build_absolute_uri('/').rstrip('/')
            connection.webhook_url = f"{base_url}/messenger/webhook/"
            connection.save(update_fields=['webhook_url'])
            return Response(self.get_serializer(connection).data, status=status.HTTP_200_OK)
        except MessengerConnection.DoesNotExist:
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            connection = serializer.save(user=request.user)
            base_url = request.build_absolute_uri('/').rstrip('/')
            connection.webhook_url = f"{base_url}/messenger/webhook/"
            connection.save(update_fields=['webhook_url'])
            return Response(self.get_serializer(connection).data, status=status.HTTP_201_CREATED)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        connection = self.get_object()
        connection.is_active = not connection.is_active
        connection.save()
        return Response(MessengerConnectionSerializer(connection).data)


class CrawlWebsiteView(MessengerGateMixin, APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, connection_id):
        try:
            connection = MessengerConnection.objects.get(id=connection_id, user=request.user)
        except MessengerConnection.DoesNotExist:
            return Response({'error': 'Connection not found'}, status=status.HTTP_404_NOT_FOUND)

        website_url = request.data.get('website_url') or connection.website_url
        if not website_url:
            return Response(
                {'error': 'No website URL provided. Please enter a website URL.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if request.data.get('website_url'):
            connection.website_url = website_url
            connection.save(update_fields=['website_url'])

        try:
            ai_config = connection.ai_config
            openai_api_key = ai_config.openai_api_key
        except AIConfiguration.DoesNotExist:
            openai_api_key = None

        if not openai_api_key:
            openai_api_key = get_openai_key(request.user)

        if not openai_api_key:
            return Response(
                {'error': 'OpenAI API key not configured. Please add your API key in Settings.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            from brands.services.brand_dna_service import BrandDNAService

            workspace = Workspace.objects.filter(owner=request.user).first()
            if not workspace:
                workspace = Workspace.objects.create(
                    owner=request.user,
                    name=f"{request.user.username}'s Workspace"
                )
            brand, _ = Brand.objects.get_or_create(
                user=request.user,
                is_primary=True,
                defaults={
                    'workspace': workspace,
                    'brand_name': connection.page_name or f"{request.user.username}'s Brand",
                    'industry': 'General',
                    'target_region': 'Global',
                    'website_url': website_url,
                }
            )

            if brand.website_url != website_url:
                brand.website_url = website_url
                brand.save(update_fields=['website_url'])

            service = BrandDNAService(openai_api_key=openai_api_key)
            result = service.generate_brand_dna(brand)

            if result['success']:
                return Response({
                    'success': True,
                    'pages_crawled': result['pages_crawled'],
                    'total_chunks': result['total_chunks'],
                    'website_url': website_url,
                    'message': f"Website crawled! {result['pages_crawled']} pages, {result['total_chunks']} knowledge chunks created."
                })
            else:
                return Response(
                    {'success': False, 'error': result.get('error', 'Failed to crawl website')},
                    status=status.HTTP_400_BAD_REQUEST
                )

        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response(
                {'success': False, 'error': f'Website crawling failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def get(self, request, connection_id):
        try:
            connection = MessengerConnection.objects.get(id=connection_id, user=request.user)
        except MessengerConnection.DoesNotExist:
            return Response({'error': 'Connection not found'}, status=status.HTTP_404_NOT_FOUND)

        brand = Brand.objects.filter(user=request.user, is_primary=True).first()
        chunk_count = 0
        brand_dna = {}
        generated_at = None

        if brand:
            chunk_count = BrandDNAChunk.objects.filter(brand=brand).count()
            brand_dna = brand.brand_dna or {}
            generated_at = brand.brand_dna_generated_at

        website_url = connection.website_url
        if not website_url and brand:
            website_url = brand.website_url

        return Response({
            'website_url': website_url,
            'has_data': chunk_count > 0,
            'chunk_count': chunk_count,
            'pages_crawled': brand_dna.get('pages_crawled', 0),
            'generated_at': generated_at,
        })


class AIConfigurationView(MessengerGateMixin, generics.RetrieveUpdateAPIView):
    serializer_class = AIConfigurationSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        connection_id = self.kwargs.get('connection_id')
        connection = MessengerConnection.objects.get(id=connection_id, user=self.request.user)
        obj, _ = AIConfiguration.objects.get_or_create(connection=connection)
        return obj


class PDFKnowledgeBaseViewSet(MessengerGateMixin, viewsets.ModelViewSet):
    serializer_class = PDFKnowledgeBaseSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        connection_id = self.kwargs.get('connection_id')
        return PDFKnowledgeBase.objects.filter(
            connection_id=connection_id,
            connection__user=self.request.user
        )

    def perform_create(self, serializer):
        connection_id = self.kwargs.get('connection_id')
        connection = MessengerConnection.objects.get(id=connection_id, user=self.request.user)
        file_obj = self.request.FILES.get('file')
        file_size = file_obj.size if file_obj else 0
        filename = self.request.data.get('filename', file_obj.name if file_obj else 'unknown.pdf')
        serializer.save(connection=connection, file_size=file_size, filename=filename)


class ConversationViewSet(MessengerGateMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = ConversationSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_serializer_class(self):
        if self.action == 'list':
            return ConversationListSerializer
        return ConversationSerializer

    def get_queryset(self):
        connection_id = self.kwargs.get('connection_id')
        if connection_id:
            return Conversation.objects.filter(
                connection_id=connection_id,
                connection__user=self.request.user
            ).order_by('-last_message_at')
        return Conversation.objects.filter(
            connection__user=self.request.user
        ).order_by('-last_message_at')

    @action(detail=True, methods=['post'])
    def toggle_takeover(self, request, pk=None, connection_id=None):
        conversation = self.get_object()
        conversation.human_takeover = not conversation.human_takeover
        conversation.save()
        return Response(ConversationSerializer(conversation).data)

    @action(detail=True, methods=['post'])
    def send_message(self, request, pk=None, connection_id=None):
        import requests as req

        conversation = self.get_object()
        content = request.data.get('content', '')

        if not content:
            return Response({'error': 'Message content is required'}, status=status.HTTP_400_BAD_REQUEST)

        connection = conversation.connection

        url = "https://graph.facebook.com/v18.0/me/messages"
        payload = {
            'recipient': {'id': conversation.sender_id},
            'message': {'text': content},
            'messaging_type': 'RESPONSE'
        }
        params = {'access_token': connection.page_access_token}

        try:
            fb_response = req.post(url, json=payload, params=params, timeout=10)

            if fb_response.status_code == 200:
                message = Message.objects.create(
                    conversation=conversation,
                    sender='bot',
                    message_type='text',
                    text=f"[Human] {content}",
                    model_used='human',
                    timestamp=timezone.now(),
                    delivered=True,
                )
                conversation.message_count += 1
                conversation.save()
                return Response(MessageSerializer(message).data)
            else:
                return Response(
                    {'error': f'Facebook API error: {fb_response.text}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Exception as e:
            return Response(
                {'error': f'Failed to send message: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class NotificationViewSet(MessengerGateMixin, viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return Notification.objects.filter(
            connection__user=self.request.user
        ).order_by('-created_at')

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save()
        return Response(NotificationSerializer(notification).data)

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        notification = self.get_object()
        notification.is_resolved = True
        notification.resolved_at = timezone.now()
        notification.save()
        return Response(NotificationSerializer(notification).data)

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        Notification.objects.filter(
            connection__user=request.user,
            is_read=False
        ).update(is_read=True)
        return Response({'message': 'All notifications marked as read'})


class CustomPromptViewSet(MessengerGateMixin, viewsets.ModelViewSet):
    serializer_class = CustomPromptSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        connection_id = self.kwargs.get('connection_id')
        return CustomPrompt.objects.filter(
            connection_id=connection_id,
            connection__user=self.request.user
        )

    def perform_create(self, serializer):
        connection_id = self.kwargs.get('connection_id')
        connection = MessengerConnection.objects.get(id=connection_id, user=self.request.user)
        serializer.save(connection=connection)

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None, connection_id=None):
        prompt = self.get_object()
        CustomPrompt.objects.filter(
            connection=prompt.connection,
            is_active=True
        ).update(is_active=False)
        prompt.is_active = True
        prompt.save()
        return Response(CustomPromptSerializer(prompt).data)


class MessengerDashboardView(MessengerGateMixin, APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        connections = MessengerConnection.objects.filter(user=request.user)
        connection_ids = connections.values_list('id', flat=True)

        total_conversations = Conversation.objects.filter(connection_id__in=connection_ids).count()
        active_conversations = Conversation.objects.filter(
            connection_id__in=connection_ids, is_active=True
        ).count()
        total_messages = Message.objects.filter(conversation__connection_id__in=connection_ids).count()
        unread_notifications = Notification.objects.filter(
            connection_id__in=connection_ids, is_read=False
        ).count()
        total_tokens = Message.objects.filter(
            conversation__connection_id__in=connection_ids, sender='bot'
        ).aggregate(Sum('tokens_used'))['tokens_used__sum'] or 0

        recent_conversations = Conversation.objects.filter(
            connection_id__in=connection_ids
        ).order_by('-last_message_at')[:5]

        return Response({
            'connections_count': connections.count(),
            'active_connections': connections.filter(is_active=True).count(),
            'total_conversations': total_conversations,
            'active_conversations': active_conversations,
            'total_messages': total_messages,
            'unread_notifications': unread_notifications,
            'total_tokens': total_tokens,
            'recent_conversations': ConversationListSerializer(recent_conversations, many=True).data,
        })


# ===================== E-COMMERCE VIEWS (gated) =====================

class ECommerceSettingsView(MessengerGateMixin, generics.RetrieveUpdateAPIView):
    serializer_class = ECommerceSettingsSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        connection_id = self.kwargs.get('connection_id')
        connection = MessengerConnection.objects.get(id=connection_id, user=self.request.user)
        obj, _ = ECommerceSettings.objects.get_or_create(
            connection=connection,
            defaults={'store_url': '', 'consumer_key': '', 'consumer_secret': '', 'is_enabled': False}
        )
        return obj


class TestECommerceConnectionView(MessengerGateMixin, APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, connection_id):
        try:
            connection = MessengerConnection.objects.get(id=connection_id, user=request.user)
        except MessengerConnection.DoesNotExist:
            return Response({'error': 'Connection not found'}, status=status.HTTP_404_NOT_FOUND)
        try:
            ecom = connection.ecommerce_settings
        except ECommerceSettings.DoesNotExist:
            return Response({'error': 'E-Commerce settings not configured'}, status=status.HTTP_400_BAD_REQUEST)
        if not ecom.consumer_key or not ecom.consumer_secret:
            return Response({'success': False, 'message': 'Consumer key and secret are required'}, status=status.HTTP_400_BAD_REQUEST)

        from messenger_bot.services.woocommerce_service import WooCommerceService
        service = WooCommerceService(ecom)
        result = service.test_connection()
        return Response(result, status=status.HTTP_200_OK if result['success'] else status.HTTP_400_BAD_REQUEST)


class SyncProductsView(MessengerGateMixin, APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, connection_id):
        try:
            connection = MessengerConnection.objects.get(id=connection_id, user=request.user)
        except MessengerConnection.DoesNotExist:
            return Response({'error': 'Connection not found'}, status=status.HTTP_404_NOT_FOUND)
        try:
            ecom = connection.ecommerce_settings
        except ECommerceSettings.DoesNotExist:
            return Response({'error': 'E-Commerce settings not configured'}, status=status.HTTP_400_BAD_REQUEST)
        if not ecom.consumer_key or not ecom.consumer_secret:
            return Response({'error': 'Consumer key and secret are required.'}, status=status.HTTP_400_BAD_REQUEST)

        from messenger_bot.services.woocommerce_service import WooCommerceService
        service = WooCommerceService(ecom)
        result = service.sync_products()
        if result.get('success'):
            return Response(result)
        return Response(result, status=status.HTTP_400_BAD_REQUEST)


class RegenerateEmbeddingsView(MessengerGateMixin, APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, connection_id):
        try:
            connection = MessengerConnection.objects.get(id=connection_id, user=request.user)
        except MessengerConnection.DoesNotExist:
            return Response({'error': 'Connection not found'}, status=status.HTTP_404_NOT_FOUND)
        try:
            ecom = connection.ecommerce_settings
        except ECommerceSettings.DoesNotExist:
            return Response({'error': 'E-Commerce settings not configured'}, status=status.HTTP_400_BAD_REQUEST)

        openai_api_key = None
        try:
            openai_api_key = connection.ai_config.openai_api_key
        except AIConfiguration.DoesNotExist:
            pass
        if not openai_api_key:
            openai_api_key = get_openai_key(request.user)
        if not openai_api_key:
            return Response({'error': 'OpenAI API key not configured.'}, status=status.HTTP_400_BAD_REQUEST)

        from messenger_bot.services.woocommerce_service import WooCommerceService
        service = WooCommerceService(ecom)
        result = service.generate_product_embeddings(openai_api_key)
        if result.get('success'):
            return Response(result)
        return Response(result, status=status.HTTP_400_BAD_REQUEST)


class ProductListView(MessengerGateMixin, generics.ListAPIView):
    serializer_class = ProductListSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        connection_id = self.kwargs.get('connection_id')
        return Product.objects.filter(
            ecommerce_settings__connection_id=connection_id,
            ecommerce_settings__connection__user=self.request.user,
        )


# ── Video AI (JWT-authenticated, callable from React) ────────────────────────

def _video_generation_worker(video_gen_id, api_key, reference_image_bytes, product_position, product_scale):
    """Background thread: runs Veo generation and updates VideoGeneration status."""
    import threading
    import os
    import tempfile
    from django.db import close_old_connections
    from django.core.files.base import ContentFile
    from ai_video.models import VideoGeneration
    from ai_video.gemini_service import GeminiVideoService

    close_old_connections()
    try:
        video_gen = VideoGeneration.objects.get(id=video_gen_id)
        service = GeminiVideoService(api_key=api_key)

        result = service.generate_video(
            prompt=video_gen.prompt,
            style=video_gen.style,
            duration=video_gen.duration,
            aspect_ratio=video_gen.aspect_ratio,
            resolution='',
            reference_image=reference_image_bytes,
            brand=video_gen.brand,
        )

        if result.get('success'):
            video_bytes = result.get('video_bytes') or result.get('video_data')
            if video_bytes:
                video_gen.generated_video.save(
                    f'video_{video_gen.id}.mp4',
                    ContentFile(video_bytes),
                    save=True,
                )

            if reference_image_bytes and video_gen.generated_video:
                try:
                    input_path = video_gen.generated_video.path
                    temp_dir = tempfile.gettempdir()
                    output_filename = f"comp_{video_gen.id}_{int(time.time())}.mp4"
                    output_path = os.path.join(temp_dir, output_filename)
                    comp_success = service.add_product_to_video(
                        video_path=input_path,
                        product_image_data=reference_image_bytes,
                        output_path=output_path,
                        position=product_position,
                        scale=product_scale,
                    )
                    if comp_success:
                        with open(output_path, 'rb') as f:
                            video_gen.generated_video.save(
                                f'video_{video_gen.id}_final.mp4',
                                ContentFile(f.read()),
                                save=False,
                            )
                    if os.path.exists(output_path):
                        try: os.unlink(output_path)
                        except: pass
                except Exception as e:
                    print(f"Video product compositing failed: {e}")

            video_gen.brand_enhanced_prompt = result.get('enhanced_prompt', '')
            video_gen.status = 'completed'
            video_gen.save()

            actual_model = result.get('model_used', '') or 'veo-3.1-generate-preview'
            try:
                from accounts.services.diamond_service import deduct_diamonds
                deduct_diamonds(
                    user=video_gen.user,
                    feature=f'video_{video_gen.duration}s',
                    provider='gemini',
                    model_used=actual_model,
                    media_count=1,
                    duration_seconds=video_gen.duration,
                )
            except Exception:
                pass
        else:
            video_gen.status = 'failed'
            video_gen.error_message = result.get('error', 'Generation failed')
            video_gen.save()

    except Exception as exc:
        try:
            vg = VideoGeneration.objects.get(id=video_gen_id)
            vg.status = 'failed'
            vg.error_message = str(exc)
            vg.save()
        except Exception:
            pass
    finally:
        close_old_connections()


class VideoGenerateAPIView(APIView):
    """Start async video generation via Gemini/Veo. Returns generation_id immediately."""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        import threading
        from ai_video.models import VideoGeneration
        from accounts.api_keys import get_gemini_key

        prompt = (request.data.get('prompt') or '').strip()
        if not prompt:
            return Response({'error': 'prompt is required'}, status=status.HTTP_400_BAD_REQUEST)

        api_key = get_gemini_key(request.user)
        if not api_key:
            return Response(
                {'error': 'No Gemini API key configured. Ask your admin to add a global key.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        style = request.data.get('style', 'realistic')
        duration = int(request.data.get('duration', 8))
        aspect_ratio = request.data.get('aspect_ratio', '16:9')
        product_position = request.data.get('product_position', 'center')
        product_scale = int(request.data.get('product_scale', 50))

        # Copy/text-overlay toggle — mirrors the image endpoint's behaviour
        # so Veo gets the same "include text" / "no text" instruction the
        # image generator already receives.
        with_copy = _parse_bool(request.data.get('with_copy', 'false'), default=False)
        copy_text = (request.data.get('copy_text', '') or '').strip()
        if with_copy and copy_text:
            prompt += (
                f'\n\nIMPORTANT: This video MUST prominently feature the following marketing copy '
                f'text rendered artistically as part of the composition: "{copy_text}". '
                f'The text should be professionally designed, clearly readable, and integrated '
                f'into the visual layout. Keep the text on-screen for the duration of the clip.'
            )
        elif not with_copy:
            prompt += (
                '\n\nCRITICAL REQUIREMENT: Do NOT include any text, typography, words, letters, '
                'numbers, watermarks, or any written characters anywhere in the video. '
                'Purely visual content with zero text elements.'
            )

        brand_id = request.data.get('brand_id')
        brand = None
        if brand_id:
            try:
                brand = Brand.objects.get(id=brand_id, user=request.user)
            except Brand.DoesNotExist:
                pass

        reference_image_bytes = None
        ref_file = request.FILES.get('reference_image')
        if ref_file:
            reference_image_bytes = ref_file.read()

        title = prompt[:60] + ('…' if len(prompt) > 60 else '')
        video_gen = VideoGeneration.objects.create(
            user=request.user,
            title=title,
            prompt=prompt,
            style=style,
            duration=duration,
            aspect_ratio=aspect_ratio,
            status='processing',
            brand=brand,
        )

        thread = threading.Thread(
            target=_video_generation_worker,
            args=(video_gen.id, api_key, reference_image_bytes, product_position, product_scale),
            daemon=True,
        )
        thread.start()

        return Response({
            'generation_id': video_gen.id,
            'status': 'processing',
        }, status=status.HTTP_202_ACCEPTED)


class VideoStatusAPIView(APIView):
    """Poll the status of an async video generation job."""
    permission_classes = [IsAuthenticated]

    def get(self, request, generation_id):
        from ai_video.models import VideoGeneration
        try:
            video_gen = VideoGeneration.objects.get(id=generation_id, user=request.user)
        except VideoGeneration.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        video_url = None
        if video_gen.status == 'completed' and video_gen.generated_video:
            try:
                video_url = request.build_absolute_uri(video_gen.generated_video.url)
            except Exception:
                video_url = video_gen.generated_video.url

        return Response({
            'generation_id': video_gen.id,
            'status': video_gen.status,
            'video_url': video_url,
            'enhanced_prompt': video_gen.brand_enhanced_prompt or '',
            'error': video_gen.error_message or None,
        })


class VideoFeedbackRegenerateAPIView(APIView):
    """Persist feedback on a generated video AND start a new generation that
    incorporates the feedback into the prompt. Returns the new generation_id
    so the frontend can poll /video/status/<id>/ exactly like the original
    generation."""
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def post(self, request, generation_id):
        import threading
        from django.utils import timezone
        from ai_video.models import VideoGeneration
        from accounts.api_keys import get_gemini_key

        feedback = (request.data.get('feedback') or '').strip()
        if not feedback:
            return Response({'error': 'feedback is required'},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            original = VideoGeneration.objects.get(
                id=generation_id, user=request.user,
            )
        except VideoGeneration.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        # Persist feedback on the original generation regardless of whether
        # the regeneration succeeds — we want every feedback comment captured.
        original.user_feedback = feedback
        original.feedback_submitted_at = timezone.now()
        original.save(update_fields=['user_feedback', 'feedback_submitted_at'])

        # Upfront balance check (better UX than failing at deduction time
        # inside the worker thread). The worker still does the actual
        # `deduct_diamonds(feature='video_8s')` on completion.
        gate = diamond_gate(request.user, 'video_8s')
        if gate:
            return gate

        api_key = get_gemini_key(request.user)
        if not api_key:
            return Response(
                {'error': 'No Gemini API key configured. Ask your admin to add a global key.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        merged_prompt = (
            f"{original.prompt}\n\n"
            f"User feedback to address in this new version: {feedback}"
        )

        new_gen = VideoGeneration.objects.create(
            user=request.user,
            title=original.title,
            prompt=merged_prompt,
            style=original.style,
            duration=8,
            aspect_ratio=original.aspect_ratio,
            status='processing',
            brand=original.brand,
            regenerated_from=original,
        )

        thread = threading.Thread(
            target=_video_generation_worker,
            args=(new_gen.id, api_key, None, 'center', 50),
            daemon=True,
        )
        thread.start()

        return Response({
            'generation_id': new_gen.id,
            'status': 'processing',
        }, status=status.HTTP_202_ACCEPTED)


class VideoHistoryAPIView(APIView):
    """Return the user's recent video generations."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from ai_video.models import VideoGeneration
        qs = VideoGeneration.objects.filter(user=request.user).order_by('-created_at')[:20]
        data = []
        for v in qs:
            video_url = None
            if v.generated_video:
                try:
                    video_url = request.build_absolute_uri(v.generated_video.url)
                except Exception:
                    video_url = v.generated_video.url
            data.append({
                'id': v.id,
                'title': v.title,
                'prompt': v.prompt,
                'style': v.style,
                'duration': v.duration,
                'status': v.status,
                'video_url': video_url,
                'created_at': v.created_at.isoformat(),
            })
        return Response({'results': data})
