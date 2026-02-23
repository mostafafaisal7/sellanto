# C:\Users\Trust computer\Desktop\Final_version_socialSync\accounts\admin.py

from django.contrib import admin
from django.utils.html import format_html
from .models import UserProfile, SiteConfiguration, SupportDocument

@admin.register(SiteConfiguration)
class SiteConfigurationAdmin(admin.ModelAdmin):
    list_display = ['key', 'value_preview', 'description', 'is_active', 'updated_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['key', 'description']
    list_editable = ['is_active']
    
    fieldsets = (
        ('Configuration', {
            'fields': ('key', 'value', 'description')
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
    )
    
    def value_preview(self, obj):
        """Show preview of value"""
        if len(obj.value) > 50:
            return obj.value[:50] + '...'
        return obj.value
    value_preview.short_description = 'Value'

@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'is_approved', 'subscription_plan', 'posts_this_month', 'created_at']
    list_filter = ['is_approved', 'subscription_plan']
    search_fields = ['user__username', 'user__email', 'company']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('User Info', {
            'fields': ('user', 'is_approved', 'phone', 'company', 'avatar')
        }),
        ('Subscription', {
            'fields': ('subscription_plan', 'max_social_accounts', 'max_posts_per_month', 'posts_this_month')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )


@admin.register(SupportDocument)
class SupportDocumentAdmin(admin.ModelAdmin):
    list_display = ['title', 'is_active', 'text_preview', 'file_size', 'uploaded_at']
    list_filter = ['is_active', 'uploaded_at']
    search_fields = ['title', 'extracted_text']
    list_editable = ['is_active']
    readonly_fields = ['extracted_text', 'uploaded_at', 'updated_at']

    fieldsets = (
        ('Document', {
            'fields': ('title', 'file', 'is_active'),
            'description': 'Upload PDF documents to add knowledge to the Sellanto AI Support Chatbot.'
        }),
        ('Extracted Content', {
            'fields': ('extracted_text',),
            'classes': ('collapse',),
            'description': 'Text automatically extracted from the PDF. This is what the AI chatbot uses as knowledge.'
        }),
        ('Timestamps', {
            'fields': ('uploaded_at', 'updated_at'),
        }),
    )

    def text_preview(self, obj):
        if obj.extracted_text:
            preview = obj.extracted_text[:80] + '...' if len(obj.extracted_text) > 80 else obj.extracted_text
            return preview
        return format_html('<span style="color: #f59e0b;">Pending extraction</span>')
    text_preview.short_description = 'Content Preview'

    def file_size(self, obj):
        if obj.file:
            try:
                size = obj.file.size
                if size < 1024:
                    return f"{size} B"
                elif size < 1024 * 1024:
                    return f"{size / 1024:.1f} KB"
                else:
                    return f"{size / (1024 * 1024):.1f} MB"
            except Exception:
                return "—"
        return "—"
    file_size.short_description = 'File Size'

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        # Re-extract text if file changed
        if 'file' in form.changed_data:
            obj.extracted_text = ''
            obj._extract_text()