# ai_video/urls.py

from django.urls import path
from . import views

app_name = 'ai_video'

urlpatterns = [
    # Main generator page
    path('', views.video_generator, name='generator'),
    
    # API Settings
    path('settings/', views.api_settings, name='api_settings'),
    
    # Logo Management
    path('logos/', views.manage_logos, name='manage_logos'),
    
    # Generation
    path('generate/', views.generate_video_ajax, name='generate'),
    path('result/<int:pk>/', views.video_result, name='result'),
    path('download/<int:pk>/', views.download_video, name='download'),
    
    # History
    path('history/', views.generation_history, name='history'),
    path('delete/<int:pk>/', views.delete_generation, name='delete'),
    
    # Saved Videos
    path('saved/', views.saved_videos, name='saved'),
    path('save/', views.save_video, name='save'),
    path('saved/favorite/<int:pk>/', views.toggle_favorite_video, name='toggle_favorite'),
    path('saved/delete/<int:pk>/', views.delete_saved_video, name='delete_saved'),
]
