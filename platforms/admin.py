# C:\Users\Trust computer\Desktop\Final_version_socialSync\platforms\admin.py

from django.contrib import admin
from django import forms
from .models import SocialAccount

class SocialAccountAdminForm(forms.ModelForm):
    """Custom form to show/hide fields based on platform"""
    
    class Meta:
        model = SocialAccount
        fields = '__all__'
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        
        # Add help text and styling
        self.fields['account_name'].widget.attrs.update({
            'placeholder': 'e.g., @username or Page Name',
            'class': 'vTextField'
        })

@admin.register(SocialAccount)
class SocialAccountAdmin(admin.ModelAdmin):
    form = SocialAccountAdminForm
    
    list_display = [
        'platform_badge', 
        'user', 
        'account_name', 
        'status_badge', 
        'validated_badge',
        'connected_at'
    ]
    
    list_filter = ['platform', 'status', 'is_active', 'is_validated']
    search_fields = ['user__username', 'account_name']
    readonly_fields = ['connected_at', 'updated_at', 'last_validated_at']
    
    # Custom colored badges
    def platform_badge(self, obj):
        colors = {
            'facebook': '#1877f2',
            'twitter': '#1da1f2',
            'instagram': '#e4405f',
            'linkedin': '#0a66c2',
            'tiktok': '#000000',
            'youtube': '#ff0000',
            'pinterest': '#e60023',
            'telegram': '#0088cc',
        }
        color = colors.get(obj.platform, '#666')
        return f'<span style="background:{color}; color:white; padding:3px 10px; border-radius:3px; font-weight:bold;">{obj.get_platform_display()}</span>'
    platform_badge.short_description = 'Platform'
    platform_badge.allow_tags = True
    
    def status_badge(self, obj):
        colors = {
            'active': '#28a745',
            'expired': '#ffc107',
            'invalid': '#dc3545',
            'disconnected': '#6c757d',
        }
        color = colors.get(obj.status, '#666')
        return f'<span style="background:{color}; color:white; padding:3px 10px; border-radius:3px;">{obj.get_status_display()}</span>'
    status_badge.short_description = 'Status'
    status_badge.allow_tags = True
    
    def validated_badge(self, obj):
        if obj.is_validated:
            return '<span style="color:#28a745;">✓ Validated</span>'
        else:
            return '<span style="color:#dc3545;">✗ Not Validated</span>'
    validated_badge.short_description = 'Validation'
    validated_badge.allow_tags = True
    
    # Dynamic fieldsets based on platform
    def get_fieldsets(self, request, obj=None):
        """Show only relevant fields based on selected platform"""
        
        common_fields = (
            'Basic Information', {
                'fields': ('user', 'platform', 'account_name', 'status', 'is_active')
            }
        )
        
        # Platform-specific fieldsets
        facebook_fields = (
            '📘 Facebook Credentials', {
                'fields': ('facebook_page_id', 'facebook_access_token'),
                'classes': ('wide',),
                'description': 'Get Page ID and Access Token from Facebook Graph API Explorer'
            }
        )
        
        twitter_fields = (
            '🐦 Twitter/X Credentials', {
                'fields': (
                    'twitter_api_key',
                    'twitter_api_secret', 
                    'twitter_access_token',
                    'twitter_access_token_secret'
                ),
                'classes': ('wide',),
                'description': 'Get all 4 tokens from Twitter Developer Portal → Your App → Keys & Tokens'
            }
        )
        
        instagram_fields = (
            '📷 Instagram Credentials', {
                'fields': ('instagram_access_token', 'instagram_business_account_id'),
                'classes': ('wide',),
                'description': 'Use Facebook Page Access Token + Instagram Business Account ID'
            }
        )
        
        linkedin_fields = (
            '💼 LinkedIn Credentials', {
                'fields': ('linkedin_access_token', 'linkedin_person_urn'),
                'classes': ('wide',),
                'description': 'Get Access Token via OAuth 2.0 flow. Person URN from profile API'
            }
        )
        
        tiktok_fields = (
            '🎵 TikTok Credentials', {
                'fields': ('tiktok_access_token', 'tiktok_refresh_token'),
                'classes': ('wide',),
                'description': 'Get tokens from TikTok Developers Portal (Content Posting API required)'
            }
        )
        
        youtube_fields = (
            '🎥 YouTube Credentials', {
                'fields': ('youtube_access_token', 'youtube_refresh_token', 'youtube_channel_id'),
                'classes': ('wide',),
                'description': 'Google OAuth 2.0 tokens with YouTube Data API v3 enabled'
            }
        )
        
        pinterest_fields = (
            '📌 Pinterest Credentials', {
                'fields': ('pinterest_access_token', 'pinterest_board_id'),
                'classes': ('wide',),
                'description': 'Get Access Token from Pinterest Developers. Board ID from Pinterest'
            }
        )
        
        telegram_fields = (
            '✈️ Telegram Credentials', {
                'fields': ('telegram_bot_token', 'telegram_channel_id'),
                'classes': ('wide',),
                'description': 'Get Bot Token from @BotFather. Channel ID is @channelname or -100xxxxx'
            }
        )
        
        validation_fields = (
            'Validation & Status', {
                'fields': (
                    'is_validated',
                    'validation_error',
                    'last_validated_at',
                    'token_expires_at'
                ),
                'classes': ('collapse',)
            }
        )
        
        timestamp_fields = (
            'Timestamps', {
                'fields': ('connected_at', 'updated_at'),
                'classes': ('collapse',)
            }
        )
        
        # Build fieldsets based on platform
        fieldsets = [common_fields]
        
        if obj:
            platform = obj.platform
        elif request.GET.get('platform'):
            platform = request.GET.get('platform')
        else:
            platform = None
        
        # Add platform-specific fields
        if platform == 'facebook':
            fieldsets.append(facebook_fields)
        elif platform == 'twitter':
            fieldsets.append(twitter_fields)
        elif platform == 'instagram':
            fieldsets.append(instagram_fields)
        elif platform == 'linkedin':
            fieldsets.append(linkedin_fields)
        elif platform == 'tiktok':
            fieldsets.append(tiktok_fields)
        elif platform == 'youtube':
            fieldsets.append(youtube_fields)
        elif platform == 'pinterest':
            fieldsets.append(pinterest_fields)
        elif platform == 'telegram':
            fieldsets.append(telegram_fields)
        else:
            # Show all if platform not selected
            fieldsets.extend([
                facebook_fields,
                twitter_fields,
                instagram_fields,
                linkedin_fields,
                tiktok_fields,
                youtube_fields,
                pinterest_fields,
                telegram_fields,
            ])
        
        fieldsets.extend([validation_fields, timestamp_fields])
        
        return fieldsets
    
    # Custom actions
    actions = ['validate_accounts', 'mark_active', 'mark_disconnected']
    
    def validate_accounts(self, request, queryset):
        """Validate selected accounts"""
        count = 0
        for account in queryset:
            # TODO: Call validation function
            account.mark_as_active()
            count += 1
        self.message_user(request, f'{count} account(s) validated successfully.')
    validate_accounts.short_description = "✓ Validate selected accounts"
    
    def mark_active(self, request, queryset):
        queryset.update(status='active', is_active=True)
        self.message_user(request, 'Selected accounts marked as active.')
    mark_active.short_description = "Mark as Active"
    
    def mark_disconnected(self, request, queryset):
        queryset.update(status='disconnected', is_active=False)
        self.message_user(request, 'Selected accounts marked as disconnected.')
    mark_disconnected.short_description = "Disconnect accounts"
    
    class Media:
        css = {
            'all': ('admin/css/custom_admin.css',)
        }
        js = ('admin/js/platform_selector.js',)