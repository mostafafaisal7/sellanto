# ai_image/migrations/0002_fix_userimagesettings_columns.py
# Adds missing columns to ai_image_userimagesettings table
# The table was created manually with a partial schema, then 0001_initial was faked.
# Safe for fresh databases where 0001_initial already created all columns.

from django.db import migrations, connection


def add_columns_if_missing(apps, schema_editor):
    """Add columns only if they don't already exist (safe for both fresh and legacy DBs)."""
    cursor = schema_editor.connection.cursor()
    cursor.execute("PRAGMA table_info(ai_image_userimagesettings);")
    existing_columns = {row[1] for row in cursor.fetchall()}

    columns_to_add = [
        ("default_provider", "VARCHAR(20) NOT NULL DEFAULT 'openai'"),
        ("openai_model", "VARCHAR(50) NOT NULL DEFAULT 'dall-e-3'"),
        ("openai_quality", "VARCHAR(20) NOT NULL DEFAULT 'standard'"),
        ("openai_images_generated", "INT NOT NULL DEFAULT 0"),
        ("gemini_images_generated", "INT NOT NULL DEFAULT 0"),
    ]

    for col_name, col_def in columns_to_add:
        if col_name not in existing_columns:
            cursor.execute(
                f"ALTER TABLE ai_image_userimagesettings ADD COLUMN {col_name} {col_def};"
            )


class Migration(migrations.Migration):

    dependencies = [
        ('ai_image', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(add_columns_if_missing, migrations.RunPython.noop),
    ]
