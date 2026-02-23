# accounts/migrations/0003_apiusagelog_and_profile_fields.py

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('accounts', '0002_siteconfiguration'),  # Depends on your existing 0002
    ]

    operations = [
        # Add new fields to UserProfile
        migrations.AddField(
            model_name='userprofile',
            name='api_mode',
            field=models.CharField(choices=[('admin', 'Admin Provided'), ('user', 'User Provided')], default='user', max_length=20),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='admin_openai_key',
            field=models.TextField(blank=True, help_text='Admin provided OpenAI key', null=True),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='admin_gemini_key',
            field=models.TextField(blank=True, help_text='Admin provided Gemini key', null=True),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='total_openai_tokens_used',
            field=models.BigIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='total_gemini_tokens_used',
            field=models.BigIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='openai_tokens_this_month',
            field=models.BigIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='gemini_tokens_this_month',
            field=models.BigIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='last_activity',
            field=models.DateTimeField(blank=True, null=True),
        ),
        
        # Create APIUsageLog model
        migrations.CreateModel(
            name='APIUsageLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('service', models.CharField(choices=[('openai', 'OpenAI'), ('gemini', 'Gemini'), ('whisper', 'Whisper'), ('tts', 'Text-to-Speech')], max_length=20)),
                ('feature', models.CharField(choices=[('caption', 'Caption Generation'), ('video', 'Video Generation'), ('image', 'Image Generation'), ('messenger', 'Messenger Bot'), ('transcription', 'Voice Transcription'), ('tts', 'Voice Reply')], max_length=30)),
                ('tokens_used', models.IntegerField(default=0)),
                ('estimated_cost', models.DecimalField(decimal_places=6, default=0, max_digits=10)),
                ('request_data', models.TextField(blank=True, help_text='Request summary', null=True)),
                ('response_status', models.CharField(default='success', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='api_usage_logs', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'API Usage Log',
                'verbose_name_plural': 'API Usage Logs',
                'db_table': 'api_usage_logs',
                'ordering': ['-created_at'],
            },
        ),
    ]
