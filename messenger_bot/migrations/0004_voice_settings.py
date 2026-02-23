# C:\Users\Trust computer\Desktop\Final_version_socialSync\messenger_bot\migrations\0004_voice_settings.py

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('messenger_bot', '0003_alter_conversation_sender_profile_pic'),
    ]

    operations = [
        # Add voice settings to AIConfiguration
        migrations.AddField(
            model_name='aiconfiguration',
            name='voice_transcription_enabled',
            field=models.BooleanField(default=True, help_text='Transcribe incoming voice messages using Whisper'),
        ),
        migrations.AddField(
            model_name='aiconfiguration',
            name='voice_reply_enabled',
            field=models.BooleanField(default=False, help_text='Reply with voice messages (uses TTS API)'),
        ),
        migrations.AddField(
            model_name='aiconfiguration',
            name='voice_model',
            field=models.CharField(
                max_length=50,
                choices=[
                    ('nova', 'Nova (Female, Friendly)'),
                    ('alloy', 'Alloy (Neutral)'),
                    ('echo', 'Echo (Male, Warm)'),
                    ('fable', 'Fable (British)'),
                    ('onyx', 'Onyx (Deep Male)'),
                    ('shimmer', 'Shimmer (Female, Expressive)'),
                ],
                default='nova'
            ),
        ),
    ]
