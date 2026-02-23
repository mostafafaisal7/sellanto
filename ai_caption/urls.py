# C:\Users\Trust computer\Desktop\Final_version_socialSync\ai_caption\urls.py

from django.urls import path
from . import views

app_name = 'ai_caption'

urlpatterns = [
    # Main generator page
    path('', views.caption_generator, name='generator'),
    path('generate/', views.caption_generator, name='generate'),
    
    # API Settings
    path('settings/', views.api_settings, name='api_settings'),
    path('api/settings/', views.api_settings_ajax, name='api_settings_ajax'),
    
    # Result page
    path('result/<int:pk>/', views.caption_result, name='result'),
    
    # AJAX endpoints
    path('api/generate/', views.generate_ajax, name='api_generate'),
    path('api/regenerate/<int:pk>/', views.regenerate_caption, name='api_regenerate'),
    path('api/variations/', views.generate_variations, name='api_variations'),
    path('api/save/', views.save_caption, name='api_save'),
    path('api/caption/<int:pk>/', views.get_caption_data, name='api_get_caption'),
    
    # History
    path('history/', views.caption_history, name='history'),
    path('delete/<int:pk>/', views.delete_generation, name='delete'),
    
    # Saved captions
    path('saved/', views.saved_captions, name='saved'),
    path('saved/delete/<int:pk>/', views.delete_saved_caption, name='delete_saved'),
    path('saved/favorite/<int:pk>/', views.toggle_favorite, name='toggle_favorite'),
    path('saved/copy-to-post/<int:pk>/', views.copy_to_post, name='copy_to_post'),
    
    # Templates
    path('templates/', views.templates_list, name='templates'),
    path('templates/create/', views.create_template, name='create_template'),
    path('templates/use/<int:pk>/', views.use_template, name='use_template'),
    path('templates/delete/<int:pk>/', views.delete_template, name='delete_template'),
    
    # Use caption in post
    path('use-caption/', views.use_caption, name='use_caption'),
]