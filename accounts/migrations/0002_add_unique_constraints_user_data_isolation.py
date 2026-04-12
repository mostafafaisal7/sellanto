# Generated migration to add database indexes for improved user data isolation
# Optimizes queries and improves performance for user-scoped operations
#
# NOTE: OneToOneField already enforces uniqueness at the database level by default.
# This migration adds performance indexes for frequently queried relationships.
# Works with SQLite, PostgreSQL, and MySQL.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),  # Adjust this to your latest migration
    ]

    operations = [
        # Add index on DiamondTransaction for faster user queries
        # Optimizes queries like: DiamondTransaction.objects.filter(user=X).order_by('-created_at')
        migrations.AddIndex(
            model_name='diamondtransaction',
            index=models.Index(
                fields=['user', '-created_at'],
                name='diamond_tx_user_idx'
            ),
        ),

        # Add index on SystemNotification for faster user queries
        # Optimizes queries like: SystemNotification.objects.filter(user=X, is_read=False)
        migrations.AddIndex(
            model_name='systemnotification',
            index=models.Index(
                fields=['user', 'is_read', '-created_at'],
                name='sys_notif_user_idx'
            ),
        ),

        # Add composite index on UserRole for workspace + user lookups
        # Optimizes queries like: UserRole.objects.filter(workspace=X, user=Y)
        migrations.AddIndex(
            model_name='userrole',
            index=models.Index(
                fields=['workspace', 'user'],
                name='user_role_ws_usr_idx'
            ),
        ),
    ]
