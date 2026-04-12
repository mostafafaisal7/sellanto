# Generated manually on 2026-04-13

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('posts', '0006_magicmodecache'),
    ]

    operations = [
        migrations.AddField(
            model_name='post',
            name='magic_draft_id',
            field=models.IntegerField(
                blank=True,
                help_text='Links Magic Mode post to its corresponding Draft post for "Add to Calendar" flow',
                null=True
            ),
        ),
    ]
