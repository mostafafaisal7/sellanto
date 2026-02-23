from django.contrib import admin
from .models import OnboardingProgress


@admin.register(OnboardingProgress)
class OnboardingProgressAdmin(admin.ModelAdmin):
    list_display = ['user', 'current_step', 'is_completed', 'is_skipped', 'updated_at']
    list_filter = ['is_completed', 'is_skipped', 'current_step']
    search_fields = ['user__username']
    readonly_fields = ['created_at', 'updated_at']
