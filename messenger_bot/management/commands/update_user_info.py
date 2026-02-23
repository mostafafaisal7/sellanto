# C:\Users\Trust computer\Desktop\Final_version_socialSync\messenger_bot\management\commands\update_user_info.py

"""
Management command to update user info for all existing conversations
Run with: python manage.py update_user_info
"""

from django.core.management.base import BaseCommand
from messenger_bot.models import MessengerConnection, Conversation
from messenger_bot.services.message_handler import update_all_conversation_user_info
import time


class Command(BaseCommand):
    help = 'Update user info (name and profile pic) for all existing conversations'

    def add_arguments(self, parser):
        parser.add_argument(
            '--page-id',
            type=str,
            help='Specific page ID to update (optional, updates all if not specified)',
        )

    def handle(self, *args, **options):
        page_id = options.get('page_id')
        
        if page_id:
            connections = MessengerConnection.objects.filter(page_id=page_id)
        else:
            connections = MessengerConnection.objects.all()
        
        if not connections.exists():
            self.stdout.write(self.style.WARNING('No messenger connections found'))
            return
        
        total_updated = 0
        
        for connection in connections:
            self.stdout.write(f'\n📱 Processing page: {connection.page_name}')
            
            # Count conversations without user info
            conversations_without_info = Conversation.objects.filter(
                connection=connection,
                sender_name__isnull=True
            ).count()
            
            conversations_without_pic = Conversation.objects.filter(
                connection=connection,
                sender_profile_pic__isnull=True
            ).count()
            
            self.stdout.write(f'   - Conversations without name: {conversations_without_info}')
            self.stdout.write(f'   - Conversations without profile pic: {conversations_without_pic}')
            
            if conversations_without_info > 0:
                updated = update_all_conversation_user_info(connection)
                total_updated += updated
                self.stdout.write(self.style.SUCCESS(f'   ✅ Updated {updated} conversations'))
            else:
                self.stdout.write(self.style.SUCCESS(f'   ✅ All conversations already have user info'))
        
        self.stdout.write(self.style.SUCCESS(f'\n🎉 Total updated: {total_updated} conversations'))
