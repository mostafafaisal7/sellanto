# C:\Users\Trust computer\Desktop\Final_version_socialSync\posts\apps.py

from django.apps import AppConfig
import os
import sys


class PostsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'posts'
    scheduler_started = False  # Class variable to track
    
    def ready(self):
        """Start scheduler when Django starts - works for both runserver and gunicorn."""

        # Skip during management commands that don't need the scheduler
        skip_commands = {
            'migrate', 'makemigrations', 'collectstatic', 'test',
            'shell', 'createsuperuser', 'check', 'dbshell',
            'check_sla', 'sync_analytics', 'generate_weekly_report',
            'sync_comments', 'check_token_health', 'fetch_trending',
        }
        if any(cmd in sys.argv for cmd in skip_commands):
            return

        # runserver: only start in the main process (not the reloader subprocess).
        # With the auto-reloader on, Django runs ready() twice and sets RUN_MAIN=true
        # in the child that actually serves — that is the one we want. With
        # --noreload there is no child and RUN_MAIN is never set, so keying only on
        # RUN_MAIN meant the scheduler silently never started and scheduled posts sat
        # at 'scheduled' forever.
        if 'runserver' in sys.argv:
            uses_reloader = '--noreload' not in sys.argv
            if uses_reloader and os.environ.get('RUN_MAIN') != 'true':
                return
            if PostsConfig.scheduler_started:
                return
            PostsConfig.scheduler_started = True
            from .scheduler import start_scheduler
            start_scheduler()
            print("\n" + "="*70)
            print("SOCIALSYNC AUTO-SCHEDULER ACTIVE")
            print("="*70)
            print("[OK] Posts will auto-publish at scheduled time")
            print("[OK] Checking every 60 seconds")
            print("[OK] Single terminal - no extra commands needed")
            print("="*70 + "\n")
            return

        # gunicorn / wsgi: use a file lock so only ONE worker starts the scheduler.
        # flock is released automatically by the OS when the process dies,
        # so restarts always recover correctly.
        import platform as _platform
        if _platform.system() != 'Windows':
            import fcntl
            try:
                lock_file = open('/tmp/sellanto_scheduler.lock', 'w')
                fcntl.flock(lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
                # Keep reference so the lock is held for the life of this worker
                PostsConfig._scheduler_lock = lock_file
            except (IOError, OSError):
                return  # Another worker already holds the lock

        if PostsConfig.scheduler_started:
            return
        PostsConfig.scheduler_started = True

        from .scheduler import start_scheduler
        start_scheduler()
        print("[SCHEDULER] Started in gunicorn worker (pid={})".format(os.getpid()))