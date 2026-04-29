# video_studio/apps.py

from django.apps import AppConfig


class VideoStudioConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'video_studio'
    verbose_name = 'Video Studio'

    def ready(self):
        # Import signals if needed
        pass
