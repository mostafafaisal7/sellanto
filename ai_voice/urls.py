# ai_voice/urls.py

from django.urls import path
from . import views

app_name = 'ai_voice'

urlpatterns = [
    # Main pages
    path('', views.generator, name='generator'),
    path('history/', views.history, name='history'),
    path('settings/', views.voice_settings, name='settings'),
    
    # API endpoints
    path('generate/', views.generate_voice, name='generate'),
    path('preview/', views.preview_voice, name='preview'),
    
    # Generation actions
    path('generation/<int:generation_id>/', views.get_generation, name='get_generation'),
    path('generation/<int:generation_id>/delete/', views.delete_generation, name='delete_generation'),
    path('generation/<int:generation_id>/download/', views.download_audio, name='download'),
    path('generation/<int:generation_id>/regenerate/', views.regenerate, name='regenerate'),
]
