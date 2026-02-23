# ai_image/apps.py

from django.apps import AppConfig


class AiImageConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'ai_image'
    verbose_name = 'AI Image Generator'
