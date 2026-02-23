# C:\Users\Trust computer\Desktop\Final_version_socialSync\messenger_bot\migrations\0003_alter_conversation_sender_profile_pic.py

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('messenger_bot', '0002_notification'),
    ]

    operations = [
        # Fix Conversation sender_profile_pic
        migrations.AlterField(
            model_name='conversation',
            name='sender_profile_pic',
            field=models.TextField(blank=True, null=True),
        ),
        # Fix Message image_url
        migrations.AlterField(
            model_name='message',
            name='image_url',
            field=models.TextField(blank=True, null=True),
        ),
        # Fix Message file_url
        migrations.AlterField(
            model_name='message',
            name='file_url',
            field=models.TextField(blank=True, null=True),
        ),
        # Add human_takeover field
        migrations.AddField(
            model_name='conversation',
            name='human_takeover',
            field=models.BooleanField(default=False),
        ),
    ]
