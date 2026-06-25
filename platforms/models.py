# C:\Users\Trust computer\Desktop\Final_version_socialSync\platforms\models.py

from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
import json
import uuid

class SocialAccount(models.Model):
    """Stores social media account credentials - Platform specific fields"""
    
    PLATFORM_CHOICES = [
        ('facebook', 'Facebook'),
        ('twitter', 'X (Twitter)'),
        ('instagram', 'Instagram'),
        ('linkedin', 'LinkedIn'),
        ('tiktok', 'TikTok'),
        ('youtube', 'YouTube'),
        ('pinterest', 'Pinterest'),
        ('reddit', 'Reddit'),
        ('telegram', 'Telegram'),
        ('messenger', 'Facebook Messenger'),
        ('google_business', 'Google Business Profile'),
    ]
    
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('expired', 'Token Expired'),
        ('invalid', 'Invalid Credentials'),
        ('disconnected', 'Disconnected'),
    ]
    
    # Basic Info
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='social_accounts')
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES)
    account_name = models.CharField(max_length=200, help_text='Display name or @username')
    
    # ========================================
    # FACEBOOK CREDENTIALS
    # ========================================
    facebook_page_id = models.CharField(max_length=200, blank=True, null=True, 
        help_text='Facebook Page ID')
    facebook_access_token = models.TextField(blank=True, null=True,
        help_text='Facebook Page Access Token')
    
    # ========================================
    # TWITTER/X CREDENTIALS
    # ========================================
    twitter_api_key = models.CharField(max_length=500, blank=True, null=True,
        help_text='Twitter API Key (Consumer Key)')
    twitter_api_secret = models.CharField(max_length=500, blank=True, null=True,
        help_text='Twitter API Secret (Consumer Secret)')
    twitter_access_token = models.TextField(blank=True, null=True,
        help_text='Twitter Access Token')
    twitter_access_token_secret = models.TextField(blank=True, null=True,
        help_text='Twitter Access Token Secret')
    
    # ========================================
    # INSTAGRAM CREDENTIALS
    # ========================================
    instagram_access_token = models.TextField(blank=True, null=True,
        help_text='Instagram Graph API Access Token (same as Facebook)')
    instagram_business_account_id = models.CharField(max_length=200, blank=True, null=True,
        help_text='Instagram Business Account ID')
    
    # ========================================
    # LINKEDIN CREDENTIALS
    # ========================================
    linkedin_access_token = models.TextField(blank=True, null=True,
        help_text='LinkedIn Access Token')
    linkedin_refresh_token = models.TextField(blank=True, null=True,
        help_text='LinkedIn Refresh Token (Community Management API only)')
    linkedin_person_urn = models.CharField(max_length=200, blank=True, null=True,
        help_text='LinkedIn Person URN (urn:li:person:xxx)')
    linkedin_organization_urn = models.CharField(max_length=200, blank=True, null=True,
        help_text='LinkedIn Organization URN (urn:li:organization:xxx) for Company Page posting')
    
    # ========================================
    # TIKTOK CREDENTIALS
    # ========================================
    tiktok_access_token = models.TextField(blank=True, null=True,
        help_text='TikTok Access Token')
    tiktok_refresh_token = models.TextField(blank=True, null=True,
        help_text='TikTok Refresh Token')
    
    # ========================================
    # YOUTUBE CREDENTIALS
    # ========================================
    youtube_access_token = models.TextField(blank=True, null=True,
        help_text='YouTube/Google Access Token')
    youtube_refresh_token = models.TextField(blank=True, null=True,
        help_text='YouTube/Google Refresh Token')
    youtube_channel_id = models.CharField(max_length=200, blank=True, null=True,
        help_text='YouTube Channel ID')
    
    # ========================================
    # PINTEREST CREDENTIALS
    # ========================================
    pinterest_access_token = models.TextField(blank=True, null=True,
        help_text='Pinterest Access Token')
    pinterest_refresh_token = models.TextField(blank=True, null=True,
        help_text='Pinterest Refresh Token')
    pinterest_board_id = models.CharField(max_length=200, blank=True, null=True,
        help_text='Pinterest Board ID')

    # ========================================
    # REDDIT CREDENTIALS
    # ========================================
    reddit_access_token = models.TextField(blank=True, null=True,
        help_text='Reddit Access Token')
    reddit_refresh_token = models.TextField(blank=True, null=True,
        help_text='Reddit Refresh Token')
    reddit_username = models.CharField(max_length=200, blank=True, null=True,
        help_text='Reddit Username (u/username)')

    # ========================================
    # TELEGRAM CREDENTIALS
    # ========================================
    telegram_bot_token = models.TextField(blank=True, null=True,
        help_text='Telegram Bot Token (from @BotFather)')
    telegram_channel_id = models.CharField(max_length=200, blank=True, null=True,
        help_text='Telegram Channel ID (e.g., @channel or -100123456)')
    
    # ========================================
    # GOOGLE BUSINESS PROFILE CREDENTIALS
    # ========================================
    gbp_access_token = models.TextField(blank=True, null=True,
        help_text='Google Business Profile Access Token')
    gbp_refresh_token = models.TextField(blank=True, null=True,
        help_text='Google Business Profile Refresh Token')
    gbp_account_id = models.CharField(max_length=200, blank=True, null=True,
        help_text='GBP Account resource ID (accounts/{id})')
    gbp_location_id = models.CharField(max_length=200, blank=True, null=True,
        help_text='GBP Location resource ID (locations/{id})')
    gbp_location_name = models.CharField(max_length=300, blank=True, null=True,
        help_text='Human-readable business location name (e.g. "Seven Door Spa")')

    # ========================================
    # COMMON FIELDS
    # ========================================
    token_expires_at = models.DateTimeField(blank=True, null=True,
        help_text='When the access token expires')
    
    # Status & Validation
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    is_active = models.BooleanField(default=True)
    is_validated = models.BooleanField(default=False)
    validation_error = models.TextField(blank=True, null=True)
    last_validated_at = models.DateTimeField(blank=True, null=True)
    
    # Timestamps
    connected_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'social_accounts'
        verbose_name = 'Social Account'
        verbose_name_plural = 'Social Accounts'
        unique_together = ['user', 'platform', 'account_name']
        ordering = ['-connected_at']
    
    def __str__(self):
        return f"{self.user.username} - {self.get_platform_display()} ({self.account_name})"
    
    def get_credentials(self):
        """Get platform-specific credentials as dictionary"""
        credentials = {}
        
        if self.platform == 'facebook':
            credentials = {
                'page_id': self.facebook_page_id,
                'access_token': self.facebook_access_token,
            }
        
        elif self.platform == 'twitter':
            credentials = {
                'api_key': self.twitter_api_key,
                'api_secret': self.twitter_api_secret,
                'access_token': self.twitter_access_token,
                'access_token_secret': self.twitter_access_token_secret,
            }
        
        elif self.platform == 'instagram':
            credentials = {
                'access_token': self.instagram_access_token,
                'business_account_id': self.instagram_business_account_id,
            }
        
        elif self.platform == 'linkedin':
            credentials = {
                'access_token': self.linkedin_access_token,
                'refresh_token': self.linkedin_refresh_token,
                'person_urn': self.linkedin_person_urn,
                'organization_urn': self.linkedin_organization_urn,
            }
        
        elif self.platform == 'tiktok':
            credentials = {
                'access_token': self.tiktok_access_token,
                'refresh_token': self.tiktok_refresh_token,
            }
        
        elif self.platform == 'youtube':
            credentials = {
                'access_token': self.youtube_access_token,
                'refresh_token': self.youtube_refresh_token,
                'channel_id': self.youtube_channel_id,
            }
        
        elif self.platform == 'pinterest':
            credentials = {
                'access_token': self.pinterest_access_token,
                'refresh_token': self.pinterest_refresh_token,
                'board_id': self.pinterest_board_id,
            }

        elif self.platform == 'reddit':
            credentials = {
                'access_token': self.reddit_access_token,
                'refresh_token': self.reddit_refresh_token,
                'username': self.reddit_username,
            }

        elif self.platform == 'telegram':
            credentials = {
                'bot_token': self.telegram_bot_token,
                'channel_id': self.telegram_channel_id,
            }

        elif self.platform == 'google_business':
            credentials = {
                'access_token': self.gbp_access_token,
                'refresh_token': self.gbp_refresh_token,
                'account_id': self.gbp_account_id,
                'location_id': self.gbp_location_id,
                'location_name': self.gbp_location_name,
            }

        return credentials
    
    def is_token_expired(self):
        """Check if token is expired"""
        if not self.token_expires_at:
            return False
        return timezone.now() > self.token_expires_at
    
    def mark_as_expired(self):
        """Mark account as expired"""
        self.status = 'expired'
        self.is_active = False
        self.save()
    
    def mark_as_invalid(self, error_message):
        """Mark account as invalid"""
        self.status = 'invalid'
        self.is_active = False
        self.validation_error = error_message
        self.save()
    
    def mark_as_active(self):
        """Mark account as active"""
        self.status = 'active'
        self.is_active = True
        self.is_validated = True
        self.validation_error = None
        self.last_validated_at = timezone.now()
        self.save()


class OAuthState(models.Model):
    """
    One-time CSRF token for OAuth flows.
    Created when user clicks Connect, validated when provider redirects back.
    Automatically expires after 10 minutes. Marked used on first validation
    to prevent replay attacks.
    """
    state      = models.UUIDField(default=uuid.uuid4, unique=True, primary_key=True)
    user       = models.ForeignKey(User, on_delete=models.CASCADE, related_name='oauth_states')
    platform   = models.CharField(max_length=32, default='facebook')
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used       = models.BooleanField(default=False)

    class Meta:
        db_table = 'oauth_states'

    def __str__(self):
        return f"{self.user.username} – {self.platform} – {'used' if self.used else 'pending'}"