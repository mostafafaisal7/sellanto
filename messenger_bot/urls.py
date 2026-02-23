# C:\Users\Trust computer\Desktop\Final_version_socialSync\messenger_bot\urls.py

"""
Messenger Bot URLs
URL routing for messenger bot functionality with notifications
"""

from django.urls import path
from . import views

app_name = 'messenger_bot'

urlpatterns = [
    # Connection
    path('connect/', views.connect_messenger, name='connect'),
    path('success/', views.messenger_success, name='success'),
    path('disconnect/', views.disconnect_messenger, name='disconnect'),
    
    # Dashboard
    path('dashboard/', views.messenger_dashboard, name='dashboard'),
    path('settings/', views.messenger_settings, name='settings'),
    
    # PDF Management
    path('upload-pdf/', views.upload_pdf, name='upload_pdf'),
    path('delete-pdf/<int:pdf_id>/', views.delete_pdf, name='delete_pdf'),
    
    # Prompts Management
    path('prompts/<int:prompt_id>/activate/', views.activate_prompt, name='activate_prompt'),
    path('prompts/<int:prompt_id>/delete/', views.delete_prompt, name='delete_prompt'),
    
    # User Info
    path('refresh-user-info/', views.refresh_user_info, name='refresh_user_info'),
    path('debug-facebook-api/', views.debug_facebook_api, name='debug_facebook_api'),
    
    # Human Takeover & Manual Messages
    path('conversation/<int:conversation_id>/toggle-human/', views.toggle_human_takeover, name='toggle_human_takeover'),
    path('conversation/<int:conversation_id>/send-message/', views.send_manual_message, name='send_manual_message'),
    
    # Notifications
    path('notifications/', views.get_notifications, name='get_notifications'),
    path('notifications/<int:notification_id>/read/', views.mark_notification_read, name='mark_notification_read'),
    path('notifications/<int:notification_id>/resolve/', views.mark_notification_resolved, name='mark_notification_resolved'),
    path('notifications/<int:notification_id>/delete/', views.delete_notification, name='delete_notification'),
    path('notifications/mark-all-read/', views.mark_all_notifications_read, name='mark_all_notifications_read'),
    path('notifications/delete-all-read/', views.delete_all_read_notifications, name='delete_all_read_notifications'),
    
    # Webhook
    path('webhook/<str:page_id>/', views.webhook, name='webhook'),
]
