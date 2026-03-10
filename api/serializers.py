from rest_framework import serializers
from django.contrib.auth.models import User
from accounts.models import UserProfile, SystemNotification, UserRole
from posts.models import (
    Post, PostCaption, PostHashtag, HashtagGroup,
    BannedHashtag, ScheduledPostPlatform
)
from platforms.models import SocialAccount
from ai_caption.models import CaptionGeneration, CaptionTemplate, SavedCaption, UserAPISettings
from ai_image.models import (
    ImageGeneration, SavedImage, UserLogo, PromptTemplate, UserImageSettings,
    AssetPlatformVariant, CreativeVersionHistory
)
from ai_video.models import VideoGeneration, SavedVideo, VideoLogo, VideoPromptTemplate, UserVideoSettings
from ai_voice.models import VoiceGeneration, UserVoiceSettings
from messenger_bot.models import MessengerConnection, AIConfiguration, PDFKnowledgeBase, Conversation, Message, Notification, CustomPrompt, ECommerceSettings, Product
from analytics.models import Analytics, PostAnalytics, PostComment, LearningSignal, RepurposedContent
from onboarding.models import OnboardingProgress
from brands.models import (
    Workspace, Brand, BrandAsset, LaunchPlan,
    ContentIdea, ContentApproval, WeeklyReport, GenerationUsage,
    BrandDNAChunk, ContentPillar, CompetitorProfile, CompetitorInsight,
    BrandTemplate, TrendingCache, ApprovalLog, BestTimeSuggestion
)
import json


class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer for UserProfile model"""

    class Meta:
        model = UserProfile
        fields = [
            'avatar',
            'phone',
            'company',
            'subscription_plan',
            'max_posts_per_month',
            'posts_this_month',
            'max_captions_per_month',
            'captions_this_month',
            'max_social_accounts',
            'is_approved',
        ]
        read_only_fields = ['is_approved', 'posts_this_month', 'captions_this_month']


class OnboardingStatusSerializer(serializers.ModelSerializer):
    """Lightweight serializer for onboarding status in user response"""
    needs_onboarding = serializers.BooleanField(read_only=True)

    class Meta:
        model = OnboardingProgress
        fields = ['current_step', 'is_completed', 'is_skipped', 'needs_onboarding']


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model with profile"""
    profile = UserProfileSerializer(read_only=True)
    onboarding_status = serializers.SerializerMethodField()
    overflow_status = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_staff', 'profile', 'onboarding_status', 'overflow_status']
        read_only_fields = ['id', 'is_staff']

    def get_onboarding_status(self, obj):
        try:
            return OnboardingStatusSerializer(obj.onboarding_progress).data
        except OnboardingProgress.DoesNotExist:
            return {'current_step': 1, 'is_completed': False, 'is_skipped': False, 'needs_onboarding': True}

    def get_overflow_status(self, obj):
        try:
            progress = obj.overflow_progress
            return {
                'is_completed': progress.is_completed or progress.is_skipped,
                'current_step': progress.current_step,
            }
        except Exception:
            return {'is_completed': False, 'current_step': 1}


class RegisterSerializer(serializers.Serializer):
    """Serializer for user registration"""
    username = serializers.CharField(min_length=3, max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(min_length=6, write_only=True)
    password_confirm = serializers.CharField(write_only=True)
    phone = serializers.CharField(required=False, allow_blank=True)
    company = serializers.CharField(required=False, allow_blank=True)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username already exists")
        return value

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Email already exists")
        return value

    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match"})
        return data

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
        )
        # Update profile (signal already creates it via post_save)
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.phone = validated_data.get('phone', '')
        profile.company = validated_data.get('company', '')
        profile.is_approved = True
        profile.save()
        return user


class RegisterWithBrandSerializer(serializers.Serializer):
    """Extended registration that also creates Workspace + Brand + initial DNA"""
    # User fields (same as RegisterSerializer)
    username = serializers.CharField(min_length=3, max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(min_length=6, write_only=True)
    password_confirm = serializers.CharField(write_only=True)
    phone = serializers.CharField(required=False, allow_blank=True)
    company = serializers.CharField(required=False, allow_blank=True)

    # Brand fields
    brand_name = serializers.CharField(max_length=200)
    industry = serializers.CharField(max_length=200)
    target_region = serializers.CharField(max_length=200)
    website_url = serializers.URLField(required=False, allow_blank=True)
    voice_tone = serializers.CharField(max_length=100, required=False, default='professional')
    products_services = serializers.CharField(required=False, allow_blank=True,
        help_text='Comma-separated list of products/services')
    competitors = serializers.ListField(
        child=serializers.DictField(), required=False, default=list,
        help_text='List of competitor objects with platform and handle_or_url')

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username already exists")
        return value

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Email already exists")
        return value

    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match"})
        return data

    def create(self, validated_data):
        from brands.models import Workspace, Brand, BrandDNAHistory
        from onboarding.models import OnboardingProgress
        from django.db import transaction
        from django.utils import timezone

        with transaction.atomic():
            # 1. Create User + Profile
            user = User.objects.create_user(
                username=validated_data['username'],
                email=validated_data['email'],
                password=validated_data['password'],
            )
            profile, _ = UserProfile.objects.get_or_create(user=user)
            profile.phone = validated_data.get('phone', '')
            profile.company = validated_data.get('company', '')
            profile.is_approved = True
            profile.save()

            # 2. Create default Workspace
            workspace = Workspace.objects.create(
                owner=user,
                name=f"{validated_data['brand_name']} Workspace",
                timezone='UTC',
                default_language='en',
            )

            # 3. Create Brand
            products_raw = validated_data.get('products_services', '')
            products_list = [p.strip() for p in products_raw.split(',') if p.strip()] if products_raw else []

            voice = validated_data.get('voice_tone', 'professional') or 'professional'
            website = validated_data.get('website_url', '') or ''

            brand = Brand.objects.create(
                workspace=workspace,
                user=user,
                brand_name=validated_data['brand_name'],
                industry=validated_data['industry'],
                target_region=validated_data['target_region'],
                website_url=website,
                voice_tone=voice,
                is_primary=True,
            )

            # 4. Generate structured DNA immediately
            from api.views import build_structured_dna
            dna_data = build_structured_dna(
                brand_name=brand.brand_name,
                industry=brand.industry,
                target_region=brand.target_region,
                voice_tone=brand.voice_tone,
                products_services=products_list,
                website_url=brand.website_url or '',
            )
            brand.brand_dna = dna_data
            brand.brand_dna_generated_at = timezone.now()
            brand.brand_dna_source = 'structured'
            brand.save(update_fields=['brand_dna', 'brand_dna_generated_at', 'brand_dna_source'])

            # 5. Save to DNA history
            BrandDNAHistory.objects.create(
                brand=brand,
                dna_data=dna_data,
                website_url=brand.website_url or '',
                source='structured',
                is_active=True,
            )

            # 6. Create competitors if provided
            competitors_data = validated_data.get('competitors', [])
            from brands.models import CompetitorProfile
            for comp in competitors_data:
                platform = comp.get('platform', 'website')
                handle_or_url = comp.get('handle_or_url', '')
                if handle_or_url:
                    CompetitorProfile.objects.create(
                        brand=brand,
                        platform=platform,
                        handle_or_url=handle_or_url,
                    )

            # 7. Mark onboarding steps 1 & 2 as completed (workspace + brand created)
            try:
                onboarding = OnboardingProgress.objects.get(user=user)
                onboarding.mark_step_completed(1)
                onboarding.mark_step_completed(2)
            except OnboardingProgress.DoesNotExist:
                pass

        return user, workspace, brand


class LoginSerializer(serializers.Serializer):
    """Serializer for user login"""
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


class SocialAccountSerializer(serializers.ModelSerializer):
    """Serializer for SocialAccount model"""

    class Meta:
        model = SocialAccount
        fields = [
            'id',
            'platform',
            'account_name',
            'status',
            'is_active',
            'is_validated',
            'validation_error',
            'last_validated_at',
            'token_expires_at',
        ]
        read_only_fields = ['id', 'status', 'is_validated', 'validation_error', 'last_validated_at']


class PostSerializer(serializers.ModelSerializer):
    """Serializer for Post model"""
    platforms = serializers.SerializerMethodField()
    media_files = serializers.SerializerMethodField()
    platform_results = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            'id',
            'caption',
            'media_files',
            'platforms',
            'scheduled_time',
            'timezone',
            'status',
            'ai_generated',
            'created_at',
            'updated_at',
            'posted_at',
            'platform_results',
        ]
        read_only_fields = ['id', 'status', 'ai_generated', 'created_at', 'updated_at', 'posted_at']

    def get_platforms(self, obj):
        try:
            return json.loads(obj.platforms) if obj.platforms else []
        except (json.JSONDecodeError, TypeError):
            return []

    def get_media_files(self, obj):
        try:
            files = json.loads(obj.media_files) if obj.media_files else []
        except (json.JSONDecodeError, TypeError):
            return []
        request = self.context.get('request')
        result = []
        for f in files:
            if not f:
                continue
            if f.startswith('http'):
                result.append(f)
            elif request:
                from django.conf import settings
                result.append(request.build_absolute_uri(f'{settings.MEDIA_URL}{f}'))
            else:
                result.append(f'/media/{f}')
        return result

    def get_platform_results(self, obj):
        results = []
        platform_list = self.get_platforms(obj)

        for platform in platform_list:
            post_id_field = f'{platform}_post_id'
            error_field = f'{platform}_error'

            post_id = getattr(obj, post_id_field, None)
            error = getattr(obj, error_field, None)

            results.append({
                'platform': platform,
                'success': bool(post_id) and not error,
                'post_id': post_id,
                'error': error,
            })

        return results


class CreatePostSerializer(serializers.Serializer):
    """Serializer for creating a new post"""
    caption = serializers.CharField(max_length=5000)
    platforms = serializers.ListField(child=serializers.CharField())
    scheduled_time = serializers.DateTimeField()
    timezone = serializers.CharField(default='UTC')

    def validate_platforms(self, value):
        # Ensure value is a list
        if not isinstance(value, list):
            value = [value]
        
        valid_platforms = ['facebook', 'twitter', 'instagram', 'linkedin', 'tiktok', 'youtube', 'pinterest', 'telegram']
        for platform in value:
            if not isinstance(platform, str):
                continue
            if platform not in valid_platforms:
                raise serializers.ValidationError(f"Invalid platform: {platform}")
        return value


class UpdatePostSerializer(serializers.Serializer):
    """Serializer for updating a post"""
    caption = serializers.CharField(max_length=5000, required=False)
    platforms = serializers.ListField(child=serializers.CharField(), required=False)
    scheduled_time = serializers.DateTimeField(required=False)


class DashboardStatsSerializer(serializers.Serializer):
    """Serializer for dashboard statistics"""
    total_posts = serializers.IntegerField()
    scheduled_posts = serializers.IntegerField()
    posted_posts = serializers.IntegerField()
    failed_posts = serializers.IntegerField()
    posts_this_month = serializers.IntegerField()
    connected_accounts = serializers.IntegerField()
    subscription_plan = serializers.CharField()
    max_posts_per_month = serializers.IntegerField()
    max_social_accounts = serializers.IntegerField()


class GenerateCaptionSerializer(serializers.Serializer):
    """Serializer for AI caption generation request"""
    topic = serializers.CharField(required=False, allow_blank=True)
    tone = serializers.ChoiceField(choices=[
        'professional', 'casual', 'friendly', 'enthusiastic',
        'humorous', 'inspirational', 'formal', 'conversational'
    ])
    length = serializers.ChoiceField(choices=['short', 'medium', 'long', 'extra_long'])
    platform = serializers.ChoiceField(choices=[
        'general', 'facebook', 'instagram', 'twitter', 'linkedin',
        'tiktok', 'youtube', 'pinterest'
    ])
    include_hashtags = serializers.BooleanField(default=True)
    include_emojis = serializers.BooleanField(default=True)
    include_cta = serializers.BooleanField(default=False)
    custom_instructions = serializers.CharField(required=False, allow_blank=True)


# ===================== EXTENDED USER PROFILE =====================

class UserProfileDetailSerializer(serializers.ModelSerializer):
    """Detailed UserProfile serializer with all fields"""

    class Meta:
        model = UserProfile
        fields = [
            'id', 'is_approved', 'phone', 'company', 'avatar',
            # Subscription
            'subscription_plan', 'plan_start_date', 'plan_end_date', 'plan_duration_months',
            # Limits
            'max_social_accounts', 'max_posts_per_month', 'max_captions_per_month',
            'max_videos_per_month', 'max_images_per_month', 'max_messenger_messages',
            # Usage
            'posts_this_month', 'captions_this_month', 'videos_this_month',
            'images_this_month', 'messenger_messages_this_month',
            # API Mode
            'api_mode',
            # Token Usage
            'total_openai_tokens_used', 'total_gemini_tokens_used',
            'openai_tokens_this_month', 'gemini_tokens_this_month',
            # Timestamps
            'created_at', 'updated_at', 'last_activity',
        ]
        read_only_fields = ['id', 'is_approved', 'created_at', 'updated_at']


class UserDetailSerializer(serializers.ModelSerializer):
    """Detailed User serializer with full profile"""
    profile = UserProfileDetailSerializer(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name',
                  'is_staff', 'is_active', 'date_joined', 'profile']
        read_only_fields = ['id', 'is_staff', 'is_active', 'date_joined']


class UpdateProfileSerializer(serializers.Serializer):
    """Serializer for updating user profile"""
    first_name = serializers.CharField(required=False)
    last_name = serializers.CharField(required=False)
    email = serializers.EmailField(required=False)
    phone = serializers.CharField(required=False, allow_blank=True)
    company = serializers.CharField(required=False, allow_blank=True)
    api_mode = serializers.ChoiceField(choices=['admin', 'user'], required=False)
    openai_api_key = serializers.CharField(required=False, allow_blank=True)
    gemini_api_key = serializers.CharField(required=False, allow_blank=True)


# ===================== SOCIAL ACCOUNT EXTENDED =====================

class SocialAccountDetailSerializer(serializers.ModelSerializer):
    """Detailed SocialAccount serializer with all credential fields"""

    class Meta:
        model = SocialAccount
        fields = [
            'id', 'platform', 'account_name', 'status', 'is_active', 'is_validated',
            'validation_error', 'last_validated_at', 'token_expires_at',
            'connected_at', 'updated_at',
            # Facebook
            'facebook_page_id', 'facebook_access_token',
            # Twitter
            'twitter_api_key', 'twitter_api_secret',
            'twitter_access_token', 'twitter_access_token_secret',
            # Instagram
            'instagram_access_token', 'instagram_business_account_id',
            # LinkedIn
            'linkedin_access_token', 'linkedin_person_urn',
            # TikTok
            'tiktok_access_token', 'tiktok_refresh_token',
            # YouTube
            'youtube_access_token', 'youtube_refresh_token', 'youtube_channel_id',
            # Pinterest
            'pinterest_access_token', 'pinterest_board_id',
            # Telegram
            'telegram_bot_token', 'telegram_channel_id',
        ]
        read_only_fields = ['id', 'status', 'is_validated', 'validation_error',
                           'last_validated_at', 'connected_at', 'updated_at']
        extra_kwargs = {
            'account_name': {'required': False, 'allow_blank': True},
            'facebook_access_token': {'write_only': True},
            'twitter_api_secret': {'write_only': True},
            'twitter_access_token_secret': {'write_only': True},
            'instagram_access_token': {'write_only': True},
            'linkedin_access_token': {'write_only': True},
            'tiktok_access_token': {'write_only': True},
            'tiktok_refresh_token': {'write_only': True},
            'youtube_access_token': {'write_only': True},
            'youtube_refresh_token': {'write_only': True},
            'pinterest_access_token': {'write_only': True},
            'telegram_bot_token': {'write_only': True},
        }


# ===================== AI CAPTION SERIALIZERS =====================

class CaptionGenerationSerializer(serializers.ModelSerializer):
    """Serializer for CaptionGeneration model"""

    class Meta:
        model = CaptionGeneration
        fields = [
            'id', 'input_text', 'media_file', 'media_type',
            'tone', 'length', 'platform',
            'include_hashtags', 'include_emojis', 'include_cta',
            'custom_instructions', 'generated_caption', 'generated_hashtags',
            'media_analysis', 'tokens_used', 'model_used', 'processing_time',
            'status', 'error_message',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'generated_caption', 'generated_hashtags',
                           'media_analysis', 'tokens_used', 'model_used',
                           'processing_time', 'status', 'error_message',
                           'created_at', 'updated_at']


class CaptionTemplateSerializer(serializers.ModelSerializer):
    """Serializer for CaptionTemplate model"""

    class Meta:
        model = CaptionTemplate
        fields = ['id', 'name', 'category', 'template_text',
                  'tone', 'platform', 'is_global', 'created_at']
        read_only_fields = ['id', 'is_global', 'created_at']


class SavedCaptionSerializer(serializers.ModelSerializer):
    """Serializer for SavedCaption model"""

    class Meta:
        model = SavedCaption
        fields = ['id', 'caption_text', 'hashtags', 'caption_generation',
                  'is_favorite', 'used_count', 'created_at']
        read_only_fields = ['id', 'created_at']


class UserAPISettingsSerializer(serializers.ModelSerializer):
    """Serializer for UserAPISettings model.
    API keys are now admin-managed globally — no per-user keys."""

    class Meta:
        model = UserAPISettings
        fields = ['id', 'default_model', 'total_tokens_used', 'total_generations',
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'total_tokens_used', 'total_generations',
                           'created_at', 'updated_at']


# ===================== AI IMAGE SERIALIZERS =====================

class UserImageSettingsSerializer(serializers.ModelSerializer):
    """Serializer for UserImageSettings model.
    API keys are now admin-managed globally — no per-user keys."""

    class Meta:
        model = UserImageSettings
        fields = ['id', 'default_provider', 'default_style', 'default_size',
                  'openai_model', 'openai_quality',
                  'total_images_generated', 'total_api_calls',
                  'openai_images_generated', 'gemini_images_generated',
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'total_images_generated', 'total_api_calls',
                           'openai_images_generated', 'gemini_images_generated',
                           'created_at', 'updated_at']


class UserLogoSerializer(serializers.ModelSerializer):
    """Serializer for UserLogo model"""

    class Meta:
        model = UserLogo
        fields = ['id', 'name', 'logo_file', 'is_default', 'created_at']
        read_only_fields = ['id', 'created_at']


class ImageGenerationSerializer(serializers.ModelSerializer):
    """Serializer for ImageGeneration model"""

    class Meta:
        model = ImageGeneration
        fields = [
            'id', 'provider', 'model_used', 'title', 'prompt', 'negative_prompt',
            'style', 'size', 'quality', 'logo', 'logo_position', 'logo_size', 'logo_opacity',
            'product_image', 'product_position', 'product_scale', 'composited_image',
            'seed', 'enhance_prompt', 'add_lighting', 'camera_angle',
            'brand_style_anchor', 'prompt_engineering_used', 'failure_codes', 'reprompt_attempt',
            'generated_image', 'generated_image_with_logo', 'enhanced_prompt', 'revised_prompt',
            'processing_time', 'status', 'error_message',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'generated_image', 'generated_image_with_logo',
                           'enhanced_prompt', 'revised_prompt', 'processing_time',
                           'brand_style_anchor', 'prompt_engineering_used', 'failure_codes', 'reprompt_attempt',
                           'status', 'error_message', 'created_at', 'updated_at']


class SavedImageSerializer(serializers.ModelSerializer):
    """Serializer for SavedImage model"""

    class Meta:
        model = SavedImage
        fields = ['id', 'title', 'image_file', 'prompt', 'image_generation',
                  'is_favorite', 'download_count', 'created_at']
        read_only_fields = ['id', 'created_at']


class PromptTemplateSerializer(serializers.ModelSerializer):
    """Serializer for PromptTemplate model"""

    class Meta:
        model = PromptTemplate
        fields = ['id', 'name', 'category', 'prompt_template',
                  'negative_prompt', 'recommended_style', 'recommended_size',
                  'preview_image', 'is_global', 'created_at']
        read_only_fields = ['id', 'is_global', 'created_at']


class GenerateImageSerializer(serializers.Serializer):
    """Serializer for image generation request"""
    title = serializers.CharField(required=False, allow_blank=True)
    prompt = serializers.CharField()
    negative_prompt = serializers.CharField(required=False, allow_blank=True)
    provider = serializers.ChoiceField(choices=['gemini', 'openai'], default='gemini')
    style = serializers.CharField(required=False, default='realistic')
    size = serializers.CharField(required=False, default='1024x1024')
    quality = serializers.CharField(required=False, default='standard')
    logo_id = serializers.IntegerField(required=False, allow_null=True)
    logo_position = serializers.CharField(required=False, default='bottom_right')
    logo_size = serializers.IntegerField(required=False, default=15)
    logo_opacity = serializers.IntegerField(required=False, default=100)
    enhance_prompt = serializers.BooleanField(default=False)
    add_lighting = serializers.CharField(required=False, allow_blank=True)
    camera_angle = serializers.CharField(required=False, allow_blank=True)


# ===================== AI VIDEO SERIALIZERS =====================

class UserVideoSettingsSerializer(serializers.ModelSerializer):
    """Serializer for UserVideoSettings model.
    API keys are now admin-managed globally — no per-user keys."""

    class Meta:
        model = UserVideoSettings
        fields = ['id', 'default_style', 'default_duration', 'default_resolution',
                  'total_videos_generated', 'total_api_calls', 'total_duration_generated',
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'total_videos_generated', 'total_api_calls',
                           'total_duration_generated', 'created_at', 'updated_at']


class VideoLogoSerializer(serializers.ModelSerializer):
    """Serializer for VideoLogo model"""

    class Meta:
        model = VideoLogo
        fields = ['id', 'name', 'logo_file', 'is_default', 'created_at']
        read_only_fields = ['id', 'created_at']


class VideoGenerationSerializer(serializers.ModelSerializer):
    """Serializer for VideoGeneration model"""

    class Meta:
        model = VideoGeneration
        fields = [
            'id', 'title', 'prompt', 'negative_prompt', 'style',
            'duration', 'resolution', 'aspect_ratio', 'fps',
            'camera_motion', 'motion_intensity',
            'logo', 'logo_position', 'logo_size', 'logo_opacity',
            'seed', 'enhance_prompt', 'reference_image',
            'generated_video', 'generated_video_with_logo', 'thumbnail', 'enhanced_prompt',
            'processing_time', 'file_size', 'status', 'error_message',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'generated_video', 'generated_video_with_logo', 'thumbnail',
                           'enhanced_prompt', 'processing_time', 'file_size',
                           'status', 'error_message', 'created_at', 'updated_at']


class SavedVideoSerializer(serializers.ModelSerializer):
    """Serializer for SavedVideo model"""

    class Meta:
        model = SavedVideo
        fields = ['id', 'title', 'video_file', 'thumbnail', 'prompt',
                  'video_generation', 'duration', 'is_favorite', 'download_count', 'created_at']
        read_only_fields = ['id', 'created_at']


class VideoPromptTemplateSerializer(serializers.ModelSerializer):
    """Serializer for VideoPromptTemplate model"""

    class Meta:
        model = VideoPromptTemplate
        fields = ['id', 'name', 'category', 'prompt_template',
                  'negative_prompt', 'recommended_style', 'recommended_duration',
                  'recommended_aspect_ratio', 'preview_thumbnail', 'is_global', 'created_at']
        read_only_fields = ['id', 'is_global', 'created_at']


class GenerateVideoSerializer(serializers.Serializer):
    """Serializer for video generation request"""
    title = serializers.CharField(required=False, allow_blank=True)
    prompt = serializers.CharField()
    negative_prompt = serializers.CharField(required=False, allow_blank=True)
    style = serializers.CharField(required=False, default='cinematic')
    duration = serializers.IntegerField(required=False, default=5)
    resolution = serializers.CharField(required=False, default='1080p')
    aspect_ratio = serializers.CharField(required=False, default='16:9')
    fps = serializers.IntegerField(required=False, default=30)
    camera_motion = serializers.CharField(required=False, default='static')
    logo_id = serializers.IntegerField(required=False, allow_null=True)
    logo_position = serializers.CharField(required=False, default='bottom_right')
    logo_size = serializers.IntegerField(required=False, default=10)
    logo_opacity = serializers.IntegerField(required=False, default=80)
    enhance_prompt = serializers.BooleanField(default=False)


# ===================== MESSENGER BOT SERIALIZERS =====================

class MessengerConnectionSerializer(serializers.ModelSerializer):
    """Serializer for MessengerConnection model"""

    class Meta:
        model = MessengerConnection
        fields = [
            'id', 'page_id', 'page_name', 'page_access_token',
            'verify_token', 'webhook_url', 'is_webhook_verified',
            'is_active', 'auto_reply_enabled', 'greeting_text',
            'website_url', 'connected_at', 'last_synced',
        ]
        read_only_fields = ['id', 'verify_token', 'is_webhook_verified', 'connected_at', 'last_synced']
        extra_kwargs = {
            'page_access_token': {'write_only': True, 'required': False, 'allow_blank': True},
            'webhook_url': {'required': False},
        }


class AIConfigurationSerializer(serializers.ModelSerializer):
    """Serializer for AIConfiguration model"""

    class Meta:
        model = AIConfiguration
        fields = [
            'id', 'connection', 'openai_api_key', 'openai_model',
            'embedding_model', 'temperature', 'max_tokens',
            'rag_enabled', 'top_k_results', 'similarity_threshold',
            'image_understanding_enabled', 'voice_transcription_enabled',
            'voice_reply_enabled', 'voice_model',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'connection', 'created_at', 'updated_at']
        extra_kwargs = {
            'openai_api_key': {'write_only': True},
        }


class PDFKnowledgeBaseSerializer(serializers.ModelSerializer):
    """Serializer for PDFKnowledgeBase model"""

    class Meta:
        model = PDFKnowledgeBase
        fields = [
            'id', 'connection', 'filename', 'file', 'file_size',
            'total_pages', 'total_chunks', 'status', 'error_message',
            'uploaded_at', 'vectorized_at',
        ]
        read_only_fields = ['id', 'connection', 'file_size', 'total_pages', 'total_chunks',
                           'status', 'error_message', 'uploaded_at', 'vectorized_at']


class CustomPromptSerializer(serializers.ModelSerializer):
    """Serializer for CustomPrompt model"""

    class Meta:
        model = CustomPrompt
        fields = [
            'id', 'connection', 'name', 'system_prompt', 'tone',
            'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'connection', 'created_at', 'updated_at']


class MessageSerializer(serializers.ModelSerializer):
    """Serializer for Message model"""

    class Meta:
        model = Message
        fields = [
            'id', 'conversation', 'sender', 'message_type', 'text',
            'image_url', 'file_url', 'tokens_used', 'processing_time',
            'rag_context_used', 'image_description', 'model_used',
            'timestamp',
        ]
        read_only_fields = ['id', 'tokens_used', 'processing_time',
                           'rag_context_used', 'image_description',
                           'model_used', 'timestamp']


class ConversationListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for conversation list (no messages)"""

    class Meta:
        model = Conversation
        fields = [
            'id', 'connection', 'sender_id', 'sender_name', 'sender_profile_pic',
            'is_active', 'human_takeover', 'message_count',
            'last_message_at', 'started_at',
        ]
        read_only_fields = ['id', 'sender_id', 'sender_name', 'sender_profile_pic',
                           'message_count', 'last_message_at', 'started_at']


class ConversationSerializer(serializers.ModelSerializer):
    """Full serializer for conversation detail (includes messages)"""
    messages = MessageSerializer(many=True, read_only=True)

    class Meta:
        model = Conversation
        fields = [
            'id', 'connection', 'sender_id', 'sender_name', 'sender_profile_pic',
            'is_active', 'human_takeover', 'message_count',
            'last_message_at', 'started_at', 'messages',
        ]
        read_only_fields = ['id', 'sender_id', 'sender_name', 'sender_profile_pic',
                           'message_count', 'last_message_at', 'started_at']


class NotificationSerializer(serializers.ModelSerializer):
    """Serializer for Notification model"""

    class Meta:
        model = Notification
        fields = [
            'id', 'connection', 'conversation', 'message',
            'notification_type', 'title', 'summary', 'priority',
            'is_read', 'is_resolved', 'resolved_at', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


# ===================== E-COMMERCE SERIALIZERS =====================

class ECommerceSettingsSerializer(serializers.ModelSerializer):
    """Serializer for ECommerceSettings model"""
    product_count = serializers.SerializerMethodField()

    class Meta:
        model = ECommerceSettings
        fields = [
            'id', 'connection', 'platform_type', 'store_url',
            'consumer_key', 'consumer_secret',
            'is_enabled', 'product_match_threshold', 'currency_symbol',
            'last_synced', 'product_count', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'connection', 'last_synced', 'created_at', 'updated_at']
        extra_kwargs = {
            'consumer_key': {'write_only': True, 'required': False, 'allow_blank': True},
            'consumer_secret': {'write_only': True, 'required': False, 'allow_blank': True},
            'store_url': {'required': False, 'allow_blank': True},
        }

    def get_product_count(self, obj):
        return obj.products.count()


class ProductSerializer(serializers.ModelSerializer):
    """Full serializer for Product model"""

    class Meta:
        model = Product
        fields = [
            'id', 'woo_product_id', 'name', 'description', 'short_description',
            'price', 'regular_price', 'sale_price', 'sku',
            'stock_status', 'stock_quantity', 'permalink',
            'images', 'categories', 'synced_at',
        ]
        read_only_fields = ['id', 'synced_at']


class ProductListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for product list"""
    first_image = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'woo_product_id', 'name', 'price', 'sale_price',
            'sku', 'stock_status', 'stock_quantity',
            'first_image', 'categories', 'synced_at',
        ]

    def get_first_image(self, obj):
        if obj.images and len(obj.images) > 0:
            return obj.images[0].get('src', '')
        return ''


# ===================== ANALYTICS SERIALIZERS =====================

class AnalyticsSerializer(serializers.ModelSerializer):
    """Serializer for Analytics model"""

    class Meta:
        model = Analytics
        fields = [
            'id', 'post', 'platform', 'metric_type', 'metric_value',
            'recorded_at', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class AnalyticsSummarySerializer(serializers.Serializer):
    """Serializer for analytics summary"""
    total_likes = serializers.IntegerField()
    total_shares = serializers.IntegerField()
    total_comments = serializers.IntegerField()
    total_views = serializers.IntegerField()
    total_impressions = serializers.IntegerField()
    engagement_rate = serializers.FloatField()


class PlatformAnalyticsSerializer(serializers.Serializer):
    """Serializer for platform-specific analytics"""
    platform = serializers.CharField()
    likes = serializers.IntegerField()
    shares = serializers.IntegerField()
    comments = serializers.IntegerField()
    views = serializers.IntegerField()
    impressions = serializers.IntegerField()
    engagement_rate = serializers.FloatField()
    post_count = serializers.IntegerField()


# ===================== ONBOARDING SERIALIZERS =====================

class OnboardingProgressSerializer(serializers.ModelSerializer):
    """Full OnboardingProgress serializer"""
    needs_onboarding = serializers.BooleanField(read_only=True)

    class Meta:
        model = OnboardingProgress
        fields = [
            'id', 'current_step', 'completed_steps', 'is_completed',
            'is_skipped', 'skipped_at', 'completed_at', 'needs_onboarding',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'completed_at', 'skipped_at', 'created_at', 'updated_at']


# ===================== WORKSPACE & BRAND SERIALIZERS =====================

class WorkspaceSerializer(serializers.ModelSerializer):
    """Serializer for Workspace model"""
    can_generate = serializers.BooleanField(read_only=True)

    class Meta:
        model = Workspace
        fields = [
            'id', 'name', 'timezone', 'team_size', 'default_language',
            'max_generations_per_day', 'generations_today', 'is_active',
            'can_generate', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'generations_today', 'created_at', 'updated_at']


class BrandSerializer(serializers.ModelSerializer):
    """Serializer for Brand model"""

    class Meta:
        model = Brand
        fields = [
            'id', 'workspace', 'brand_name', 'industry', 'target_region',
            'website_url', 'social_links', 'logo', 'brand_guide_pdf',
            'voice_tone', 'do_dont_rules', 'goals', 'audiences',
            'brand_dna', 'brand_dna_generated_at', 'brand_dna_source',
            'is_primary', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'brand_dna_generated_at', 'created_at', 'updated_at']


class BrandAssetSerializer(serializers.ModelSerializer):
    """Serializer for BrandAsset model"""

    class Meta:
        model = BrandAsset
        fields = ['id', 'brand', 'file', 'asset_type', 'name', 'description', 'created_at']
        read_only_fields = ['id', 'created_at']


class LaunchPlanSerializer(serializers.ModelSerializer):
    """Serializer for LaunchPlan model"""

    class Meta:
        model = LaunchPlan
        fields = [
            'id', 'brand', 'post_frequency', 'formats_allowed',
            'variant_generation_level', 'approval_required',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ContentIdeaSerializer(serializers.ModelSerializer):
    """Serializer for ContentIdea model"""

    class Meta:
        model = ContentIdea
        fields = [
            'id', 'brand', 'title', 'hook', 'angle', 'platform',
            'goal', 'content_format', 'language', 'persona',
            'status', 'post', 'batch_id', 'generation_run',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'batch_id', 'generation_run', 'created_at', 'updated_at']


class ContentApprovalSerializer(serializers.ModelSerializer):
    """Serializer for ContentApproval model"""
    submitted_by_username = serializers.CharField(source='submitted_by.username', read_only=True)
    approver_username = serializers.CharField(source='approver.username', read_only=True, default=None)

    class Meta:
        model = ContentApproval
        fields = [
            'id', 'post', 'submitted_by', 'submitted_by_username',
            'submitted_at', 'approver', 'approver_username', 'reviewed_at',
            'status', 'comments', 'rejection_reason', 'compliance_checklist',
            'version', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'submitted_by', 'submitted_at', 'reviewed_at', 'created_at', 'updated_at']


class WeeklyReportSerializer(serializers.ModelSerializer):
    """Serializer for WeeklyReport model"""

    class Meta:
        model = WeeklyReport
        fields = ['id', 'brand', 'period_start', 'period_end', 'data', 'generated_at']
        read_only_fields = ['id', 'generated_at']


class GenerationUsageSerializer(serializers.ModelSerializer):
    """Serializer for GenerationUsage model"""

    class Meta:
        model = GenerationUsage
        fields = ['id', 'workspace', 'generation_type', 'date', 'count']
        read_only_fields = ['id']


# ===================== AI VOICE SERIALIZERS =====================

class UserVoiceSettingsSerializer(serializers.ModelSerializer):
    """Serializer for UserVoiceSettings model.
    API keys are now admin-managed globally — no per-user keys."""

    class Meta:
        model = UserVoiceSettings
        fields = ['id', 'default_voice', 'default_speed', 'default_model',
                  'total_characters_used', 'total_generations',
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'total_characters_used', 'total_generations',
                           'created_at', 'updated_at']


class VoiceGenerationSerializer(serializers.ModelSerializer):
    """Serializer for VoiceGeneration model"""

    class Meta:
        model = VoiceGeneration
        fields = [
            'id', 'title', 'input_text', 'voice', 'model', 'speed',
            'output_format', 'audio_file', 'audio_url',
            'duration_seconds', 'file_size_bytes', 'characters_used',
            'status', 'error_message', 'processing_time',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'audio_file', 'audio_url', 'duration_seconds',
                           'file_size_bytes', 'characters_used', 'status',
                           'error_message', 'processing_time',
                           'created_at', 'updated_at']


class GenerateVoiceSerializer(serializers.Serializer):
    """Serializer for voice generation request"""
    text = serializers.CharField()
    title = serializers.CharField(required=False, allow_blank=True)
    voice = serializers.ChoiceField(
        choices=['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
        default='alloy'
    )
    model = serializers.ChoiceField(
        choices=['tts-1', 'tts-1-hd'],
        default='tts-1'
    )
    speed = serializers.FloatField(required=False, default=1.0, min_value=0.25, max_value=4.0)
    format = serializers.ChoiceField(
        choices=['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'],
        default='mp3',
        required=False
    )


# ===================== GLOBAL API KEYS SERIALIZER =====================

class GlobalAPIKeysSerializer(serializers.Serializer):
    """Serializer for centralized API key management.
    Claude is the fixed admin provider for text AI (key from env).
    OpenAI/Gemini keys are user-managed for image/video/voice generation."""
    openai_api_key = serializers.CharField(write_only=True, required=False, allow_blank=True)
    gemini_api_key = serializers.CharField(write_only=True, required=False, allow_blank=True)
    has_openai_key = serializers.BooleanField(read_only=True)
    masked_openai_key = serializers.CharField(read_only=True)
    has_gemini_key = serializers.BooleanField(read_only=True)
    masked_gemini_key = serializers.CharField(read_only=True)
    default_model = serializers.CharField(required=False, allow_blank=True)
    default_gemini_model = serializers.CharField(required=False, allow_blank=True)


# ===================== BRAND DNA SERIALIZERS =====================

class BrandDNAChunkSerializer(serializers.ModelSerializer):
    """Serializer for BrandDNAChunk model"""

    class Meta:
        model = BrandDNAChunk
        fields = ['id', 'brand', 'text', 'chunk_index', 'source_url', 'page_title', 'created_at']
        read_only_fields = ['id', 'created_at']


class BrandDNAStatusSerializer(serializers.Serializer):
    """Serializer for Brand DNA status response"""
    brand_id = serializers.IntegerField()
    brand_name = serializers.CharField()
    website_url = serializers.URLField(allow_blank=True, allow_null=True)
    brand_dna = serializers.DictField()
    brand_dna_generated_at = serializers.DateTimeField(allow_null=True)
    brand_dna_source = serializers.CharField(allow_blank=True)
    total_chunks = serializers.IntegerField()


# ===================== V1.2.1 SERIALIZERS =====================

# --- Strategy & Pillars ---

class ContentPillarSerializer(serializers.ModelSerializer):
    actual_percentage = serializers.SerializerMethodField()
    brand = serializers.PrimaryKeyRelatedField(queryset=Brand.objects.all(), required=False, allow_null=True)

    class Meta:
        model = ContentPillar
        fields = [
            'id', 'brand', 'name', 'description', 'target_percentage',
            'color_code', 'is_active', 'actual_percentage',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_actual_percentage(self, obj):
        total = obj.brand.posts.count()
        if total == 0:
            return 0
        pillar_count = obj.posts.count()
        return round((pillar_count / total) * 100, 1)


class CompetitorProfileSerializer(serializers.ModelSerializer):
    insights_count = serializers.SerializerMethodField()
    brand = serializers.PrimaryKeyRelatedField(queryset=Brand.objects.all(), required=False, allow_null=True)

    class Meta:
        model = CompetitorProfile
        fields = [
            'id', 'brand', 'platform', 'handle_or_url',
            'last_crawled_at', 'insights_count', 'created_at',
        ]
        read_only_fields = ['id', 'last_crawled_at', 'created_at']

    def get_insights_count(self, obj):
        return obj.insights.count()


class CompetitorInsightSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompetitorInsight
        fields = [
            'id', 'competitor_profile', 'hook_text', 'angle',
            'format_type', 'engagement_score', 'extracted_at',
        ]
        read_only_fields = ['id', 'extracted_at']


class BrandTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = BrandTemplate
        fields = [
            'id', 'brand', 'name', 'template_file', 'logo_position',
            'font_family', 'primary_color', 'secondary_color',
            'is_active', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class TrendingCacheSerializer(serializers.ModelSerializer):
    is_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = TrendingCache
        fields = [
            'id', 'platform', 'topic', 'volume_score',
            'region', 'is_expired', 'fetched_at', 'expires_at',
        ]
        read_only_fields = ['id', 'fetched_at']


# --- Post Captions ---

class PostCaptionSerializer(serializers.ModelSerializer):
    char_status = serializers.CharField(read_only=True)
    is_within_limit = serializers.BooleanField(read_only=True)

    class Meta:
        model = PostCaption
        fields = [
            'id', 'post', 'platform', 'variant_number', 'body',
            'cta_text', 'tone', 'char_count', 'is_selected',
            'is_ab_test', 'ab_label', 'image_prompt', 'char_status', 'is_within_limit',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'char_count', 'created_at', 'updated_at']


class GenerateCaptionsRequestSerializer(serializers.Serializer):
    topic = serializers.CharField(required=False, allow_blank=True)
    tone = serializers.CharField(default='professional')
    platforms = serializers.ListField(
        child=serializers.ChoiceField(choices=['twitter', 'linkedin', 'facebook', 'instagram', 'all']),
        default=['all']
    )
    count = serializers.IntegerField(default=3, min_value=1, max_value=10)
    include_cta = serializers.BooleanField(default=False)
    custom_instructions = serializers.CharField(required=False, allow_blank=True)


class AdaptCaptionRequestSerializer(serializers.Serializer):
    caption_id = serializers.IntegerField()
    target_platforms = serializers.ListField(
        child=serializers.ChoiceField(choices=['twitter', 'linkedin', 'facebook', 'instagram'])
    )


# --- Hashtags ---

class PostHashtagSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostHashtag
        fields = [
            'id', 'post', 'platform', 'tag', 'tier',
            'estimated_volume', 'is_selected', 'placement', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class HashtagGroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = HashtagGroup
        fields = ['id', 'brand', 'name', 'tags', 'created_by', 'created_at']
        read_only_fields = ['id', 'created_by', 'created_at']


class BannedHashtagSerializer(serializers.ModelSerializer):
    class Meta:
        model = BannedHashtag
        fields = ['id', 'brand', 'tag', 'reason', 'added_by', 'created_at']
        read_only_fields = ['id', 'added_by', 'created_at']


class GenerateHashtagsRequestSerializer(serializers.Serializer):
    platform = serializers.ChoiceField(choices=['twitter', 'linkedin', 'facebook', 'instagram'])
    caption_text = serializers.CharField(required=False, allow_blank=True)
    topic = serializers.CharField(required=False, allow_blank=True)
    count = serializers.IntegerField(default=20, min_value=1, max_value=30)


# --- Creative Assets ---

class AssetPlatformVariantSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssetPlatformVariant
        fields = [
            'id', 'asset', 'platform', 'format_label',
            'file_url', 'dimensions', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class CreativeVersionHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = CreativeVersionHistory
        fields = ['id', 'asset', 'version', 'file_url', 'generation_params', 'created_at']
        read_only_fields = ['id', 'created_at']


# --- Approval ---

class ApprovalLogSerializer(serializers.ModelSerializer):
    acted_by_username = serializers.CharField(source='acted_by.username', read_only=True)

    class Meta:
        model = ApprovalLog
        fields = [
            'id', 'post', 'action', 'acted_by', 'acted_by_username',
            'comment', 'rejection_reason', 'created_at',
        ]
        read_only_fields = ['id', 'acted_by', 'created_at']


class SubmitForApprovalSerializer(serializers.Serializer):
    comment = serializers.CharField(required=False, allow_blank=True)


class ApprovePostSerializer(serializers.Serializer):
    comment = serializers.CharField(required=False, allow_blank=True)


class RequestChangesSerializer(serializers.Serializer):
    comment = serializers.CharField()


class RejectPostSerializer(serializers.Serializer):
    rejection_reason = serializers.ChoiceField(
        choices=['off_brand', 'compliance_issue', 'quality', 'factual_error', 'timing', 'other']
    )
    comment = serializers.CharField(required=False, allow_blank=True)


class BestTimeSuggestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = BestTimeSuggestion
        fields = [
            'id', 'brand', 'platform', 'day_of_week', 'hour_utc',
            'score', 'source', 'computed_at',
        ]
        read_only_fields = ['id', 'computed_at']


# --- Scheduling ---

class ScheduledPostPlatformSerializer(serializers.ModelSerializer):
    caption_body = serializers.CharField(source='caption.body', read_only=True, default='')

    class Meta:
        model = ScheduledPostPlatform
        fields = [
            'id', 'post', 'platform', 'caption', 'caption_body',
            'hashtag_placement', 'scheduled_at', 'timezone', 'status',
            'publish_result_json', 'retry_count', 'created_by',
            'created_at', 'published_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'published_at']


class SchedulePostRequestSerializer(serializers.Serializer):
    platforms = serializers.ListField(child=serializers.DictField())
    # Each dict: {"platform": "twitter", "caption_id": 1, "scheduled_at": "...", "hashtag_placement": "end_of_caption"}


class ConflictCheckRequestSerializer(serializers.Serializer):
    platform = serializers.CharField()
    scheduled_at = serializers.DateTimeField()
    buffer_minutes = serializers.IntegerField(default=30)


# --- Analytics ---

class PostAnalyticsSerializer(serializers.ModelSerializer):
    performance_indicator = serializers.CharField(read_only=True)

    class Meta:
        model = PostAnalytics
        fields = [
            'id', 'post', 'platform', 'platform_post_id', 'snapshot_type',
            'impressions', 'reach', 'engagement_rate', 'likes',
            'comments_count', 'shares', 'clicks', 'saves', 'profile_visits',
            'data_json', 'performance_indicator', 'fetched_at',
        ]
        read_only_fields = ['id', 'fetched_at']


class PostCommentSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostComment
        fields = [
            'id', 'post', 'platform', 'platform_comment_id',
            'author_name', 'author_handle', 'body', 'sentiment',
            'replied', 'reply_type', 'reply_body', 'replied_at', 'fetched_at',
        ]
        read_only_fields = ['id', 'fetched_at']


class ReplyToCommentSerializer(serializers.Serializer):
    reply_body = serializers.CharField()
    reply_type = serializers.ChoiceField(choices=['human', 'ai'], default='human')


class LearningSignalSerializer(serializers.ModelSerializer):
    class Meta:
        model = LearningSignal
        fields = ['id', 'brand', 'signal_type', 'reference_id', 'data_json', 'applied', 'created_at']
        read_only_fields = ['id', 'created_at']


class RepurposedContentSerializer(serializers.ModelSerializer):
    class Meta:
        model = RepurposedContent
        fields = ['id', 'original_post', 'new_post', 'repurpose_format', 'created_at']
        read_only_fields = ['id', 'new_post', 'created_at']


class RepurposeRequestSerializer(serializers.Serializer):
    repurpose_format = serializers.ChoiceField(
        choices=['carousel', 'thread', 'reel', 'email', 'blog_outline']
    )
    target_platform = serializers.ChoiceField(
        choices=['twitter', 'linkedin', 'facebook', 'instagram'],
        required=False
    )


# --- Notifications ---

class SystemNotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemNotification
        fields = [
            'id', 'user', 'event_type', 'title', 'message',
            'data_json', 'channel', 'is_read', 'created_at',
        ]
        read_only_fields = ['id', 'user', 'created_at']


# --- Enhanced Post Serializer with V1.2.1 fields ---

class PostDetailSerializer(serializers.ModelSerializer):
    """Extended post serializer with captions, hashtags, and analytics"""
    platforms = serializers.SerializerMethodField()
    media_files = serializers.SerializerMethodField()
    platform_results = serializers.SerializerMethodField()
    captions = PostCaptionSerializer(many=True, read_only=True)
    hashtags = PostHashtagSerializer(many=True, read_only=True)
    checklist_status = serializers.JSONField(read_only=True)
    pillar_name = serializers.CharField(source='pillar.name', read_only=True, default='')
    brand_name = serializers.CharField(source='brand.brand_name', read_only=True, default='')

    class Meta:
        model = Post
        fields = [
            'id', 'caption', 'media_files', 'platforms',
            'scheduled_time', 'timezone', 'status',
            'ai_generated', 'created_at', 'updated_at', 'posted_at',
            'platform_results',
            # V1.2.1 fields
            'idea', 'brand', 'brand_name', 'pillar', 'pillar_name',
            'hook', 'angle', 'format_type', 'cta_text', 'goal',
            'checklist_status', 'submitted_at', 'approved_at',
            'captions', 'hashtags',
        ]
        read_only_fields = ['id', 'status', 'ai_generated', 'created_at', 'updated_at', 'posted_at']

    def get_platforms(self, obj):
        try:
            return json.loads(obj.platforms) if obj.platforms else []
        except (json.JSONDecodeError, TypeError):
            return []

    def get_media_files(self, obj):
        try:
            files = json.loads(obj.media_files) if obj.media_files else []
        except (json.JSONDecodeError, TypeError):
            return []
        request = self.context.get('request')
        result = []
        for f in files:
            if not f:
                continue
            if f.startswith('http'):
                result.append(f)
            elif request:
                from django.conf import settings
                result.append(request.build_absolute_uri(f'{settings.MEDIA_URL}{f}'))
            else:
                result.append(f'/media/{f}')
        return result

    def get_platform_results(self, obj):
        results = []
        platform_list = self.get_platforms(obj)
        for platform in platform_list:
            post_id = getattr(obj, f'{platform}_post_id', None)
            error = getattr(obj, f'{platform}_error', None)
            results.append({
                'platform': platform,
                'success': bool(post_id) and not error,
                'post_id': post_id,
                'error': error,
            })
        return results


# --- Enhanced ContentIdea with V1.2.1 fields ---

class ContentIdeaDetailSerializer(serializers.ModelSerializer):
    pillar_name = serializers.CharField(source='pillar.name', read_only=True, default='')

    class Meta:
        model = ContentIdea
        fields = [
            'id', 'brand', 'title', 'hook', 'angle', 'platform',
            'goal', 'content_format', 'language', 'persona',
            'status', 'post', 'batch_id', 'generation_run',
            # V1.2.1 fields
            'pillar', 'pillar_name', 'engagement_tier', 'source',
            'trending_topic_ref', 'metadata_json',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'batch_id', 'generation_run', 'created_at', 'updated_at']


class GenerateIdeasRequestSerializer(serializers.Serializer):
    brand_id = serializers.IntegerField()
    pillar_id = serializers.IntegerField(required=False)
    platform = serializers.ChoiceField(
        choices=['twitter', 'linkedin', 'facebook', 'instagram', 'all'],
        default='all'
    )
    goal = serializers.ChoiceField(
        choices=['leads', 'growth', 'authority', ''],
        default='', required=False, allow_blank=True
    )
    content_format = serializers.CharField(required=False, allow_blank=True)
    language = serializers.CharField(default='en')
    count = serializers.IntegerField(default=10, min_value=1, max_value=50)
    trending_topics = serializers.ListField(
        child=serializers.CharField(max_length=500),
        required=False, default=list
    )


# --- Enhanced WeeklyReport with V1.2.1 fields ---

class WeeklyReportDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = WeeklyReport
        fields = [
            'id', 'brand', 'workspace', 'period_start', 'period_end', 'data',
            'winners', 'losers', 'best_hooks', 'best_times',
            'pillar_performance', 'ab_test_results', 'recommendations',
            'test_plan', 'generated_at',
        ]
        read_only_fields = ['id', 'generated_at']


# --- Calendar data serializer ---

class CalendarEventSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    title = serializers.CharField()
    start = serializers.DateTimeField()
    end = serializers.DateTimeField(required=False)
    platform = serializers.CharField()
    status = serializers.CharField()
    color = serializers.CharField(required=False)
    pillar_name = serializers.CharField(required=False, allow_blank=True)
    pillar_color = serializers.CharField(required=False, allow_blank=True)


# ===================== RBAC SERIALIZERS =====================

class UserRoleSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    workspace_name = serializers.CharField(source='workspace.name', read_only=True)
    granted_by_username = serializers.CharField(source='granted_by.username', read_only=True, default='')

    class Meta:
        model = UserRole
        fields = [
            'id', 'user', 'username', 'workspace', 'workspace_name',
            'role', 'granted_by', 'granted_by_username',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'granted_by', 'created_at', 'updated_at']


class AssignRoleSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()
    role = serializers.ChoiceField(choices=['admin', 'creator', 'approver', 'publisher', 'viewer'])


class RemoveRoleSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()
    role = serializers.ChoiceField(choices=['admin', 'creator', 'approver', 'publisher', 'viewer'])


# ─── Prompt Engineering Serializers ─────────────────────────

class PromptEngineerGenerateSerializer(serializers.Serializer):
    """Input for generating an optimized image prompt"""
    brand_id = serializers.IntegerField()
    subject = serializers.CharField()
    platform = serializers.CharField(default='instagram')
    mood = serializers.CharField(required=False, default='')
    key_message = serializers.CharField(required=False, default='')
    must_include = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    must_exclude = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    text_overlay_position = serializers.CharField(required=False, default='')


class PromptEngineerDiagnoseSerializer(serializers.Serializer):
    """Input for diagnosing a failed image"""
    image_description = serializers.CharField()
    original_prompt = serializers.CharField()
    revised_prompt = serializers.CharField(required=False, default='')


class PromptEngineerRepromptSerializer(serializers.Serializer):
    """Input for re-prompting a failed image"""
    brand_id = serializers.IntegerField()
    original_prompt = serializers.CharField()
    failure_description = serializers.CharField()
    attempt_number = serializers.IntegerField(default=1)


# ── Copy Overlay (V1.2.2) ──────────────────────────────────

class CopyOverlayGenerateSerializer(serializers.Serializer):
    """Input for generating AI copy suggestions for image overlay"""
    brand_id = serializers.IntegerField(required=False)
    caption_text = serializers.CharField(required=False, default='')
    image_description = serializers.CharField(required=False, default='')
    cta_text = serializers.CharField(required=False, default='')
    count = serializers.IntegerField(required=False, default=5, min_value=1, max_value=10)


class CopyOverlayApplySerializer(serializers.Serializer):
    """Input for applying text overlay on an image"""
    copy_text = serializers.CharField(max_length=200)
    position = serializers.ChoiceField(
        choices=['center', 'bottom_banner', 'top_banner', 'top_bottom_split'],
        default='bottom_banner',
    )
    font_style = serializers.ChoiceField(
        choices=['montserrat_bold', 'montserrat_regular', 'playfair_bold', 'roboto_bold', 'bebas_neue'],
        default='montserrat_bold',
    )
    text_color = serializers.CharField(default='#FFFFFF', max_length=7)
    overlay_opacity = serializers.IntegerField(default=60, min_value=0, max_value=100)
    font_size = serializers.IntegerField(default=0, min_value=0, max_value=200)
    text_alignment = serializers.ChoiceField(
        choices=['left', 'center', 'right'],
        default='center',
    )
    add_text_shadow = serializers.BooleanField(default=True)
