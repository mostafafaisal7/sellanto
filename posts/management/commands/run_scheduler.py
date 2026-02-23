# C:\Users\Trust computer\Desktop\Final_version_socialSync\posts\management\commands\run_scheduler.py

"""
Django management command to run the post scheduler
Usage: python manage.py run_scheduler
"""

from django.core.management.base import BaseCommand
from posts.scheduler import process_scheduled_posts
import time
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Run the post scheduler to process scheduled posts'
    
    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('🚀 Post Scheduler Started'))
        self.stdout.write('Checking for scheduled posts every minute...')
        self.stdout.write('Press Ctrl+C to stop\n')
        
        try:
            while True:
                try:
                    self.stdout.write(f'⏰ [{time.strftime("%Y-%m-%d %H:%M:%S")}] Checking scheduled posts...')
                    process_scheduled_posts()
                    
                    # Wait 1 minute
                    time.sleep(60)
                    
                except Exception as e:
                    logger.error(f"Error in scheduler loop: {str(e)}")
                    self.stdout.write(self.style.ERROR(f'❌ Error: {str(e)}'))
                    time.sleep(60)  # Wait before retrying
                    
        except KeyboardInterrupt:
            self.stdout.write(self.style.SUCCESS('\n\n✅ Scheduler stopped'))