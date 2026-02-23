# C:\Users\Trust computer\Desktop\Final_version_socialSync\messenger_bot\admin.py

"""
Messenger Bot Admin Configuration
Beautiful and functional admin panel for managing the chatbot
"""
# messenger_bot\admin.py

from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe
from .models import (
    MessengerConnection,
    AIConfiguration,
    PDFKnowledgeBase,
    PDFChunk,
    CustomPrompt,
    Conversation,
    Message
)


@admin.register(MessengerConnection)
class MessengerConnectionAdmin(admin.ModelAdmin):
    list_display = (
        'page_name', 
        'user', 
        'status_badge', 
        'auto_reply_badge',
        'webhook_status',
        'connected_at'
    )
    list_filter = ('is_active', 'auto_reply_enabled', 'is_webhook_verified', 'connected_at')
    search_fields = ('page_name', 'page_id', 'user__username')
    readonly_fields = ('verify_token', 'connected_at', 'last_synced')
    
    fieldsets = (
        ('Connection Details', {
            'fields': ('user', 'page_name', 'page_id', 'page_access_token')
        }),
        ('Webhook Configuration', {
            'fields': ('verify_token', 'webhook_url', 'is_webhook_verified'),
            'description': 'Use the verify_token in your Facebook App webhook settings'
        }),
        ('Settings', {
            'fields': ('is_active', 'auto_reply_enabled', 'greeting_text')
        }),
        ('Timestamps', {
            'fields': ('connected_at', 'last_synced'),
            'classes': ('collapse',)
        }),
    )
    
    def status_badge(self, obj):
        if obj.is_active:
            return format_html(
                '<span style="background: #10b981; color: white; padding: 3px 10px; '
                'border-radius: 10px; font-size: 11px;">✅ Active</span>'
            )
        return format_html(
            '<span style="background: #ef4444; color: white; padding: 3px 10px; '
            'border-radius: 10px; font-size: 11px;">⭕ Inactive</span>'
        )
    status_badge.short_description = 'Status'
    
    def auto_reply_badge(self, obj):
        if obj.auto_reply_enabled:
            return format_html('<span style="color: #10b981;">🤖 On</span>')
        return format_html('<span style="color: #6b7280;">⭕ Off</span>')
    auto_reply_badge.short_description = 'Auto Reply'
    
    def webhook_status(self, obj):
        if obj.is_webhook_verified:
            return format_html('<span style="color: #10b981;">✅ Verified</span>')
        return format_html('<span style="color: #f59e0b;">⏳ Pending</span>')
    webhook_status.short_description = 'Webhook'


@admin.register(AIConfiguration)
class AIConfigurationAdmin(admin.ModelAdmin):
    list_display = (
        'connection', 
        'openai_model', 
        'rag_status',
        'image_status',
        'updated_at'
    )
    list_filter = ('openai_model', 'rag_enabled', 'image_understanding_enabled')
    search_fields = ('connection__page_name',)
    readonly_fields = ('created_at', 'updated_at')
    
    fieldsets = (
        ('Connection', {
            'fields': ('connection',)
        }),
        ('OpenAI Settings', {
            'fields': ('openai_api_key', 'openai_model', 'embedding_model')
        }),
        ('RAG Configuration', {
            'fields': ('rag_enabled', 'top_k_results', 'similarity_threshold'),
            'description': 'Configure how the AI retrieves information from your knowledge base'
        }),
        ('Response Settings', {
            'fields': ('temperature', 'max_tokens')
        }),
        ('Features', {
            'fields': ('image_understanding_enabled',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def rag_status(self, obj):
        if obj.rag_enabled:
            return format_html('<span style="color: #10b981;">✅ Enabled</span>')
        return format_html('<span style="color: #6b7280;">⭕ Disabled</span>')
    rag_status.short_description = 'RAG'
    
    def image_status(self, obj):
        if obj.image_understanding_enabled:
            return format_html('<span style="color: #10b981;">🖼️ On</span>')
        return format_html('<span style="color: #6b7280;">⭕ Off</span>')
    image_status.short_description = 'Images'


@admin.register(PDFKnowledgeBase)
class PDFKnowledgeBaseAdmin(admin.ModelAdmin):
    list_display = (
        'filename_with_icon', 
        'connection', 
        'status_badge',
        'file_size_display',
        'chunks_info',
        'uploaded_at'
    )
    list_filter = ('status', 'uploaded_at')
    search_fields = ('filename', 'connection__page_name')
    readonly_fields = (
        'filename', 
        'file_size', 
        'total_chunks', 
        'total_pages',
        'vectorized_at', 
        'uploaded_at'
    )
    
    fieldsets = (
        ('File Information', {
            'fields': ('connection', 'file', 'filename', 'file_size')
        }),
        ('Processing Status', {
            'fields': ('status', 'total_chunks', 'total_pages', 'vectorized_at')
        }),
        ('Error Details', {
            'fields': ('error_message',),
            'classes': ('collapse',)
        }),
    )
    
    def filename_with_icon(self, obj):
        return format_html(
            '{} <strong>{}</strong>',
            obj.status_icon,
            obj.filename
        )
    filename_with_icon.short_description = 'File'
    
    def status_badge(self, obj):
        colors = {
            'pending': '#f59e0b',
            'processing': '#3b82f6',
            'completed': '#10b981',
            'failed': '#ef4444',
        }
        return format_html(
            '<span style="background: {}; color: white; padding: 3px 10px; '
            'border-radius: 10px; font-size: 11px;">{}</span>',
            colors.get(obj.status, '#6b7280'),
            obj.get_status_display()
        )
    status_badge.short_description = 'Status'
    
    def file_size_display(self, obj):
        size_mb = obj.file_size / (1024 * 1024)
        if size_mb < 1:
            return f"{obj.file_size / 1024:.1f} KB"
        return f"{size_mb:.2f} MB"
    file_size_display.short_description = 'Size'
    
    def chunks_info(self, obj):
        if obj.total_chunks > 0:
            return format_html(
                '<span style="color: #10b981;">📄 {} chunks</span>',
                obj.total_chunks
            )
        return format_html('<span style="color: #6b7280;">⏳ Not processed</span>')
    chunks_info.short_description = 'Chunks'


@admin.register(PDFChunk)
class PDFChunkAdmin(admin.ModelAdmin):
    list_display = ('chunk_display', 'pdf', 'page_number', 'text_preview')
    list_filter = ('pdf__connection', 'pdf')
    search_fields = ('text', 'pdf__filename')
    readonly_fields = ('created_at',)
    
    fieldsets = (
        ('Chunk Information', {
            'fields': ('pdf', 'chunk_index', 'page_number')
        }),
        ('Content', {
            'fields': ('text',)
        }),
        ('Embedding Data', {
            'fields': ('embedding',),
            'classes': ('collapse',)
        }),
    )
    
    def chunk_display(self, obj):
        return format_html(
            '<strong>Chunk #{}</strong>',
            obj.chunk_index
        )
    chunk_display.short_description = 'Chunk'
    
    def text_preview(self, obj):
        preview = obj.text[:100] + '...' if len(obj.text) > 100 else obj.text
        return preview
    text_preview.short_description = 'Preview'


@admin.register(CustomPrompt)
class CustomPromptAdmin(admin.ModelAdmin):
    list_display = (
        'name_with_status', 
        'connection', 
        'tone_badge',
        'updated_at'
    )
    list_filter = ('is_active', 'tone', 'created_at')
    search_fields = ('name', 'connection__page_name', 'system_prompt')
    readonly_fields = ('created_at', 'updated_at')
    
    fieldsets = (
        ('Prompt Details', {
            'fields': ('connection', 'name', 'is_active')
        }),
        ('System Prompt', {
            'fields': ('system_prompt',),
            'description': 'Define how your AI assistant should behave and respond'
        }),
        ('Behavior Settings', {
            'fields': ('tone',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def name_with_status(self, obj):
        icon = "✅" if obj.is_active else "⭕"
        return format_html(
            '{} <strong>{}</strong>',
            icon,
            obj.name
        )
    name_with_status.short_description = 'Prompt Name'
    
    def tone_badge(self, obj):
        colors = {
            'professional': '#3b82f6',
            'casual': '#10b981',
            'friendly': '#f59e0b',
            'technical': '#6366f1',
            'sales': '#ef4444',
            'support': '#8b5cf6',
        }
        return format_html(
            '<span style="background: {}; color: white; padding: 3px 10px; '
            'border-radius: 10px; font-size: 11px;">{}</span>',
            colors.get(obj.tone, '#6b7280'),
            obj.get_tone_display()
        )
    tone_badge.short_description = 'Tone'


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = (
        'sender_display',
        'connection',
        'message_count_badge',
        'status_badge',
        'last_message_at'
    )
    list_filter = ('is_active', 'started_at', 'connection')
    search_fields = ('sender_name', 'sender_id', 'connection__page_name')
    readonly_fields = ('started_at', 'last_message_at')
    
    fieldsets = (
        ('Conversation Details', {
            'fields': ('connection', 'sender_id', 'sender_name', 'sender_profile_pic')
        }),
        ('Metadata', {
            'fields': ('message_count', 'is_active', 'started_at', 'last_message_at')
        }),
    )
    
    def sender_display(self, obj):
        if obj.sender_profile_pic:
            return format_html(
                '<img src="{}" style="width: 30px; height: 30px; border-radius: 50%; '
                'margin-right: 8px; vertical-align: middle;">'
                '<strong>{}</strong>',
                obj.sender_profile_pic,
                obj.sender_name or obj.sender_id
            )
        return format_html(
            '👤 <strong>{}</strong>',
            obj.sender_name or obj.sender_id
        )
    sender_display.short_description = 'User'
    
    def message_count_badge(self, obj):
        return format_html(
            '<span style="background: #3b82f6; color: white; padding: 3px 10px; '
            'border-radius: 10px; font-size: 11px;">💬 {}</span>',
            obj.message_count
        )
    message_count_badge.short_description = 'Messages'
    
    def status_badge(self, obj):
        if obj.is_active:
            return format_html('<span style="color: #10b981;">✅ Active</span>')
        return format_html('<span style="color: #6b7280;">⭕ Archived</span>')
    status_badge.short_description = 'Status'


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = (
        'sender_display',
        'conversation',
        'type_badge',
        'text_preview',
        'ai_info',
        'timestamp'
    )
    list_filter = ('sender', 'message_type', 'delivered', 'failed', 'timestamp')
    search_fields = ('text', 'conversation__sender_name')
    readonly_fields = (
        'timestamp', 
        'processing_time', 
        'tokens_used',
        'rag_context_used',
        'image_description'
    )
    date_hierarchy = 'timestamp'
    
    fieldsets = (
        ('Message Details', {
            'fields': ('conversation', 'sender', 'message_type', 'timestamp')
        }),
        ('Content', {
            'fields': ('text', 'image_url', 'file_url')
        }),
        ('AI Processing (Bot Messages)', {
            'fields': (
                'model_used', 
                'tokens_used', 
                'processing_time',
                'rag_context_used',
                'prompt_used'
            ),
            'classes': ('collapse',)
        }),
        ('Image Understanding (User Images)', {
            'fields': ('image_description',),
            'classes': ('collapse',)
        }),
        ('Delivery Status', {
            'fields': ('delivered', 'read', 'failed', 'error_message'),
            'classes': ('collapse',)
        }),
    )
    
    def sender_display(self, obj):
        return format_html(
            '{} <strong>{}</strong>',
            obj.sender_icon,
            obj.get_sender_display()
        )
    sender_display.short_description = 'From'
    
    def type_badge(self, obj):
        colors = {
            'text': '#3b82f6',
            'image': '#10b981',
            'file': '#f59e0b',
            'sticker': '#ef4444',
            'quick_reply': '#8b5cf6',
        }
        return format_html(
            '<span style="background: {}; color: white; padding: 3px 8px; '
            'border-radius: 8px; font-size: 10px;">{}</span>',
            colors.get(obj.message_type, '#6b7280'),
            obj.get_message_type_display()
        )
    type_badge.short_description = 'Type'
    
    def text_preview(self, obj):
        if obj.text:
            preview = obj.text[:60] + '...' if len(obj.text) > 60 else obj.text
            return preview
        elif obj.image_url:
            return format_html('<a href="{}" target="_blank">🖼️ View Image</a>', obj.image_url)
        return '-'
    text_preview.short_description = 'Content'
    
    def ai_info(self, obj):
        if obj.sender == 'bot' and obj.processing_time:
            return format_html(
                '<span style="color: #6b7280;">⚡ {:.2f}s | 🎫 {} tokens</span>',
                obj.processing_time,
                obj.tokens_used
            )
        return '-'
    ai_info.short_description = 'AI Stats'


# Import Notification model
from .models import Notification

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = (
        'type_badge',
        'title',
        'sender_name',
        'priority_badge',
        'status_badge',
        'created_at'
    )
    list_filter = ('notification_type', 'priority', 'is_read', 'is_resolved', 'created_at')
    search_fields = ('title', 'summary', 'conversation__sender_name')
    readonly_fields = ('created_at', 'resolved_at')
    
    fieldsets = (
        ('Notification Details', {
            'fields': ('connection', 'conversation', 'message', 'notification_type', 'title', 'summary')
        }),
        ('Priority & Status', {
            'fields': ('priority', 'is_read', 'is_resolved', 'resolved_at')
        }),
        ('Timestamps', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )
    
    def type_badge(self, obj):
        colors = {
            'product_inquiry': '#8b5cf6',
            'appointment': '#3b82f6',
            'order': '#10b981',
            'urgent': '#ef4444',
            'complaint': '#f59e0b',
            'pricing': '#6366f1',
            'availability': '#14b8a6',
            'contact': '#ec4899',
            'general': '#6b7280',
        }
        color = colors.get(obj.notification_type, '#6b7280')
        return format_html(
            '<span style="background-color: {}20; color: {}; padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 11px;">{} {}</span>',
            color, color, obj.type_icon, obj.get_notification_type_display()
        )
    type_badge.short_description = 'Type'
    
    def sender_name(self, obj):
        name = obj.conversation.sender_name or obj.conversation.sender_id
        return format_html('<span style="color: #e5e7eb;">{}</span>', name[:20])
    sender_name.short_description = 'From'
    
    def priority_badge(self, obj):
        colors = {
            'high': '#ef4444',
            'medium': '#f59e0b',
            'low': '#10b981',
        }
        color = colors.get(obj.priority, '#6b7280')
        return format_html(
            '<span style="background-color: {}20; color: {}; padding: 2px 6px; border-radius: 3px; font-weight: 600; font-size: 10px;">{}</span>',
            color, color, obj.priority.upper()
        )
    priority_badge.short_description = 'Priority'
    
    def status_badge(self, obj):
        if obj.is_resolved:
            return format_html('<span style="color: #10b981;">✅ Resolved</span>')
        elif obj.is_read:
            return format_html('<span style="color: #f59e0b;">👁 Read</span>')
        else:
            return format_html('<span style="color: #ef4444;">🔔 New</span>')
    status_badge.short_description = 'Status'


# Customize admin site header and title
admin.site.site_header = "Messenger Bot Admin"
admin.site.site_title = "Messenger Bot"
admin.site.index_title = "🤖 Messenger AI Bot Management"