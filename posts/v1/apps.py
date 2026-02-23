# C:\Users\Trust computer\Desktop\Final_version_socialSync\posts\apps.py

from django.apps import AppConfig
import os
import sys


class PostsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'posts'
    scheduler_started = False  # Class variable to track
    
    def ready(self):
        """Start scheduler when Django starts"""
        
        # Only in runserver
        if 'runserver' not in sys.argv:
            return
        
        # Only in main process (not reloader)
        if os.environ.get('RUN_MAIN') != 'true':
            return
        
        # Prevent duplicate start
        if PostsConfig.scheduler_started:
            return
        
        # Mark as started
        PostsConfig.scheduler_started = True
        
        # Start scheduler
        from .scheduler import start_scheduler
        start_scheduler()
        
        print("\n" + "="*70)
        print("🚀 SOCIALSYNC AUTO-SCHEDULER ACTIVE")
        print("="*70)
        print("✅ Posts will auto-publish at scheduled time")
        print("✅ Checking every 60 seconds")
        print("✅ Single terminal - no extra commands needed")
        print("="*70 + "\n")