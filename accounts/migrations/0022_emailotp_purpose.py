from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0021_stripepaymentmethod'),
    ]

    operations = [
        migrations.AddField(
            model_name='emailotp',
            name='purpose',
            field=models.CharField(
                choices=[
                    ('signup', 'Signup / Email Verification'),
                    ('password_reset', 'Password Reset'),
                ],
                db_index=True,
                default='signup',
                max_length=20,
            ),
        ),
        migrations.AddIndex(
            model_name='emailotp',
            index=models.Index(
                fields=['user', 'purpose', '-created_at'],
                name='email_otps_user_id_purpose_idx',
            ),
        ),
    ]
