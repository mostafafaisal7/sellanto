from django.db import migrations


def lower_threshold(apps, schema_editor):
    """Lower similarity threshold from 0.7 to 0.35 for existing configs."""
    AIConfiguration = apps.get_model('messenger_bot', 'AIConfiguration')
    AIConfiguration.objects.filter(similarity_threshold__gte=0.7).update(
        similarity_threshold=0.35
    )


class Migration(migrations.Migration):

    dependencies = [
        ('messenger_bot', '0008_alter_ecommercesettings_consumer_key_and_more'),
    ]

    operations = [
        migrations.RunPython(lower_threshold, migrations.RunPython.noop),
    ]
