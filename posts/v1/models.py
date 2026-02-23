# C:\Users\Trust computer\Desktop\Final_version_socialSync\posts\models.py

from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
import json

class Post(models.Model):
    """Scheduled social media posts"""
    
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('scheduled', 'Scheduled'),
        ('posting', 'Posting'),
        ('posted', 'Posted'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='posts')
    
    # Content
    caption = models.TextField(help_text='Post caption/text')
    ai_generated = models.BooleanField(default=False, help_text='Was caption AI-generated?')
    
    # Media files
    media_files = models.TextField(default='[]', help_text='JSON array of media file paths')
    
    # Scheduling
    scheduled_time = models.DateTimeField(help_text='When to post')
    timezone = models.CharField(max_length=50, default='UTC')
    
    # Platforms (JSON array)
    platforms = models.TextField(default='[]', help_text='JSON array of platforms to post to')
    
    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    
    # Platform-specific post IDs
    facebook_post_id = models.CharField(max_length=200, blank=True, null=True)
    twitter_post_id = models.CharField(max_length=200, blank=True, null=True)
    instagram_post_id = models.CharField(max_length=200, blank=True, null=True)
    linkedin_post_id = models.CharField(max_length=200, blank=True, null=True)
    tiktok_post_id = models.CharField(max_length=200, blank=True, null=True)
    youtube_post_id = models.CharField(max_length=200, blank=True, null=True)
    pinterest_post_id = models.CharField(max_length=200, blank=True, null=True)
    telegram_post_id = models.CharField(max_length=200, blank=True, null=True)
    
    # Platform-specific errors
    facebook_error = models.TextField(blank=True, null=True)
    twitter_error = models.TextField(blank=True, null=True)
    instagram_error = models.TextField(blank=True, null=True)
    linkedin_error = models.TextField(blank=True, null=True)
    tiktok_error = models.TextField(blank=True, null=True)
    youtube_error = models.TextField(blank=True, null=True)
    pinterest_error = models.TextField(blank=True, null=True)
    telegram_error = models.TextField(blank=True, null=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    posted_at = models.DateTimeField(blank=True, null=True)
    
    class Meta:
        db_table = 'posts'
        verbose_name = 'Post'
        verbose_name_plural = 'Posts'
        ordering = ['-scheduled_time']
    
    def __str__(self):
        caption_preview = self.caption[:50] + '...' if len(self.caption) > 50 else self.caption
        return f"{self.user.username} - {caption_preview} ({self.status})"
    
    @property
    def platforms_list(self):
        """Get platforms as list"""
        try:
            return json.loads(self.platforms)
        except:
            return []
    
    def set_platforms(self, platforms):
        """Set platforms from list"""
        self.platforms = json.dumps(platforms)
    
    @property
    def media_files_list(self):
        """Get media files as list"""
        try:
            return json.loads(self.media_files)
        except:
            return []
    
    def set_media_files(self, files):
        """Set media files from list"""
        self.media_files = json.dumps(files)
    
    def is_scheduled_for_future(self):
        """Check if post is scheduled for future"""
        return self.scheduled_time > timezone.now()
    
    def can_be_edited(self):
        """Check if post can be edited"""
        return self.status in ['draft', 'scheduled']
    
    def can_be_cancelled(self):
        """Check if post can be cancelled"""
        return self.status in ['scheduled']
    
    def mark_as_posted(self):
        """Mark post as successfully posted"""
        self.status = 'posted'
        self.posted_at = timezone.now()
        self.save()
    
    def mark_as_failed(self):
        """Mark post as failed"""
        self.status = 'failed'
        self.save()
    
    def get_success_platforms(self):
        """Get list of platforms where post was successful"""
        successful = []
        if self.facebook_post_id: successful.append('facebook')
        if self.twitter_post_id: successful.append('twitter')
        if self.instagram_post_id: successful.append('instagram')
        if self.linkedin_post_id: successful.append('linkedin')
        if self.tiktok_post_id: successful.append('tiktok')
        if self.youtube_post_id: successful.append('youtube')
        if self.pinterest_post_id: successful.append('pinterest')
        if self.telegram_post_id: successful.append('telegram')
        return successful
    
    def get_failed_platforms(self):
        """Get list of platforms where post failed"""
        failed = []
        if self.facebook_error: failed.append('facebook')
        if self.twitter_error: failed.append('twitter')
        if self.instagram_error: failed.append('instagram')
        if self.linkedin_error: failed.append('linkedin')
        if self.tiktok_error: failed.append('tiktok')
        if self.youtube_error: failed.append('youtube')
        if self.pinterest_error: failed.append('pinterest')
        if self.telegram_error: failed.append('telegram')
        return failed