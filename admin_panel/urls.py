# admin_panel/urls.py

from django.urls import path
from . import views

app_name = 'admin_panel'

urlpatterns = [
    # Dashboard
    path('', views.admin_dashboard, name='dashboard'),
    path('analytics/', views.analytics, name='analytics'),
    
    # User Management
    path('users/', views.user_list, name='user_list'),
    path('users/<int:user_id>/', views.user_detail, name='user_detail'),
    
    # User Actions
    path('users/<int:user_id>/approve/', views.approve_user, name='approve_user'),
    path('users/<int:user_id>/reject/', views.reject_user, name='reject_user'),
    path('users/<int:user_id>/plan/', views.update_user_plan, name='update_user_plan'),
    path('bulk/approve/', views.bulk_approve, name='bulk_approve'),
    
    # User Data API Endpoints
    path('users/<int:user_id>/posts/', views.user_posts, name='user_posts'),
    path('users/<int:user_id>/accounts/', views.user_accounts, name='user_accounts'),
    path('users/<int:user_id>/captions/', views.user_captions, name='user_captions'),
    path('users/<int:user_id>/images/', views.user_images, name='user_images'),
    path('users/<int:user_id>/videos/', views.user_videos, name='user_videos'),
    path('users/<int:user_id>/messenger/', views.user_messenger, name='user_messenger'),
    
    # API Settings (Admin managed)
    path('users/<int:user_id>/api-settings/', views.user_api_settings, name='user_api_settings'),
    path('users/<int:user_id>/api-settings/update/', views.update_api_settings, name='update_api_settings'),
    
    # Conversation Messages
    path('conversations/<int:conv_id>/messages/', views.conversation_messages, name='conversation_messages'),
    
    # Public API for user settings pages
    path('api/check-admin-managed/', views.check_admin_managed, name='check_admin_managed'),
]
