# ai_image/migrations/0002_fix_userimagesettings_columns.py
# Adds missing columns to ai_image_userimagesettings table
# The table was created manually with a partial schema, then 0001_initial was faked.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ai_image', '0001_initial'),
    ]

    operations = [
        migrations.RunSQL(
            sql=[
                # Add default_provider column
                "ALTER TABLE ai_image_userimagesettings ADD COLUMN default_provider VARCHAR(20) NOT NULL DEFAULT 'openai';",
                # Add openai_model column
                "ALTER TABLE ai_image_userimagesettings ADD COLUMN openai_model VARCHAR(50) NOT NULL DEFAULT 'dall-e-3';",
                # Add openai_quality column
                "ALTER TABLE ai_image_userimagesettings ADD COLUMN openai_quality VARCHAR(20) NOT NULL DEFAULT 'standard';",
                # Add openai_images_generated column
                "ALTER TABLE ai_image_userimagesettings ADD COLUMN openai_images_generated INT NOT NULL DEFAULT 0;",
                # Add gemini_images_generated column
                "ALTER TABLE ai_image_userimagesettings ADD COLUMN gemini_images_generated INT NOT NULL DEFAULT 0;",
            ],
            reverse_sql=[
                "ALTER TABLE ai_image_userimagesettings DROP COLUMN default_provider;",
                "ALTER TABLE ai_image_userimagesettings DROP COLUMN openai_model;",
                "ALTER TABLE ai_image_userimagesettings DROP COLUMN openai_quality;",
                "ALTER TABLE ai_image_userimagesettings DROP COLUMN openai_images_generated;",
                "ALTER TABLE ai_image_userimagesettings DROP COLUMN gemini_images_generated;",
            ],
        ),
    ]
