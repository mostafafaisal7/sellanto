# C:\Users\Trust computer\Desktop\Final_version_socialSync\accounts\models.py


from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

class SiteConfiguration(models.Model):
    """Store site-wide configuration in database"""
    
    key = models.CharField(max_length=100, unique=True, help_text='Configuration key')
    value = models.TextField(blank=True, help_text='Configuration value')
    description = models.CharField(max_length=255, blank=True, help_text='What this setting does')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'site_configuration'
        verbose_name = 'Site Configuration'
        verbose_name_plural = 'Site Configurations'
        ordering = ['key']
    
    def __str__(self):
        return f"{self.key}: {self.value[:50]}"
    
    @staticmethod
    def get(key, default=''):
        """Get configuration value"""
        try:
            config = SiteConfiguration.objects.get(key=key, is_active=True)
            return config.value
        except SiteConfiguration.DoesNotExist:
            return default
    
    @staticmethod
    def set(key, value, description=''):
        """Set configuration value"""
        config, created = SiteConfiguration.objects.update_or_create(
            key=key,
            defaults={'value': value, 'description': description, 'is_active': True}
        )
        return config

class UserProfile(models.Model):
    """Extended user profile with approval system"""
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    is_approved = models.BooleanField(default=False, help_text='Admin approval required')
    phone = models.CharField(max_length=20, blank=True, null=True)
    company = models.CharField(max_length=200, blank=True, null=True)
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)
    
    # Subscription & Limits
    subscription_plan = models.CharField(
        max_length=20,
        choices=[
            ('free', 'Free'),
            ('pro', 'Pro'),
            ('business', 'Business'),
        ],
        default='free'
    )
    max_social_accounts = models.IntegerField(default=3)
    max_posts_per_month = models.IntegerField(default=30)
    posts_this_month = models.IntegerField(default=0)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'user_profiles'
        verbose_name = 'User Profile'
        verbose_name_plural = 'User Profiles'
    
    def __str__(self):
        return f"{self.user.username} - {'Approved' if self.is_approved else 'Pending'}"
    
    @property
    def is_admin(self):
        return self.user.is_staff or self.user.is_superuser
    
    def can_add_account(self):
        """Check if user can add more social accounts"""
        from platforms.models import SocialAccount
        current_count = SocialAccount.objects.filter(user=self.user, is_active=True).count()
        return current_count < self.max_social_accounts
    
    def reset_monthly_posts(self):
        """Reset monthly post counter"""
        self.posts_this_month = 0
        self.save()


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """Create profile when user is created"""
    if created:
        UserProfile.objects.create(user=instance)  # Changed from Profile


@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    """Save profile when user is saved"""
    # Get or create profile
    UserProfile.objects.get_or_create(user=instance)  # Changed from Profile