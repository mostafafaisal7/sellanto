# C:\Users\Trust computer\Desktop\Final_version_socialSync\messenger_bot\migrations\0002_notification.py

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('messenger_bot', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Notification',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('notification_type', models.CharField(
                    choices=[
                        ('product_inquiry', '🛒 Product Inquiry'),
                        ('appointment', '📅 Appointment Request'),
                        ('order', '📦 Order Request'),
                        ('urgent', '🔴 Urgent'),
                        ('complaint', '⚠️ Complaint'),
                        ('pricing', '💰 Pricing Question'),
                        ('availability', '📋 Availability Check'),
                        ('contact', '📞 Contact Request'),
                        ('general', '💬 Important Message'),
                    ],
                    default='general',
                    max_length=30
                )),
                ('title', models.CharField(max_length=255)),
                ('summary', models.TextField(help_text='AI-generated summary of the important message')),
                ('priority', models.CharField(
                    choices=[
                        ('high', '🔴 High'),
                        ('medium', '🟡 Medium'),
                        ('low', '🟢 Low'),
                    ],
                    default='medium',
                    max_length=10
                )),
                ('is_read', models.BooleanField(default=False)),
                ('is_resolved', models.BooleanField(default=False)),
                ('resolved_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('connection', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='notifications',
                    to='messenger_bot.messengerconnection'
                )),
                ('conversation', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='notifications',
                    to='messenger_bot.conversation'
                )),
                ('message', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='notifications',
                    to='messenger_bot.message'
                )),
            ],
            options={
                'verbose_name': 'Notification',
                'verbose_name_plural': 'Notifications',
                'db_table': 'notifications',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='notification',
            index=models.Index(fields=['connection', 'is_read'], name='notificatio_connect_idx'),
        ),
        migrations.AddIndex(
            model_name='notification',
            index=models.Index(fields=['connection', 'created_at'], name='notificatio_connect_created_idx'),
        ),
    ]
