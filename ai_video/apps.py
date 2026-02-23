# ai_video/apps.py

from django.apps import AppConfig


class AiVideoConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'ai_video'
    verbose_name = 'AI Video Generator'
