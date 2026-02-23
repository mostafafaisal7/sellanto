"""
Export data from SQLite to JSON format
Run: python export_data.py
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'socialsync.settings')
django.setup()

from django.core import management

print("📦 Exporting data from SQLite...")

# Export all data
management.call_command(
    'dumpdata',
    '--natural-foreign',
    '--natural-primary',
    '--exclude=contenttypes',
    '--exclude=auth.permission',
    '--indent=2',
    output='data_backup.json'
)

print("✅ Data exported to data_backup.json")
print("📊 File created successfully!")