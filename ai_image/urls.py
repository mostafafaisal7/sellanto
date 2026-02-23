# ai_image/urls.py

from django.urls import path
from . import views

app_name = 'ai_image'

urlpatterns = [
    # Main pages
    path('', views.image_generator, name='generator'),
    path('settings/', views.api_settings, name='api_settings'),
    path('history/', views.generation_history, name='history'),
    path('saved/', views.saved_images, name='saved'),
    path('templates/', views.prompt_templates, name='templates'),
    
    # Logo management
    path('logos/', views.manage_logos, name='manage_logos'),
    path('logos/upload/', views.upload_logo_ajax, name='upload_logo'),
    path('logos/<int:pk>/delete/', views.delete_logo, name='delete_logo'),
    
    # Image generation
    path('generate/', views.generate_image_ajax, name='generate'),
    path('result/<int:pk>/', views.image_result, name='result'),
    path('download/<int:pk>/', views.download_image, name='download'),
    
    # Image actions
    path('save/', views.save_image, name='save_image'),
    path('generation/<int:pk>/delete/', views.delete_generation, name='delete_generation'),
    path('saved/<int:pk>/favorite/', views.toggle_favorite_image, name='toggle_favorite'),
    path('saved/<int:pk>/delete/', views.delete_saved_image, name='delete_saved'),
    
    # Templates
    path('templates/<int:pk>/use/', views.use_template, name='use_template'),
]
