# C:\Users\Trust computer\Desktop\Final_version_socialSync\messenger_bot\apps.py

from django.apps import AppConfig


class MessengerBotConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'messenger_bot'
    
    def ready(self):
        from . import signals