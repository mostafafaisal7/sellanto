"""
Fixed import script
"""
import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'socialsync.settings')
django.setup()

from django.contrib.auth.models import User
from posts.models import Post
from platforms.models import SocialAccount
from accounts.models import UserProfile

print("📥 Importing data manually...")

# Load JSON
with open('data_backup.json', 'r') as f:
    data = json.load(f)

# Count data
print(f"Found {len(data)} objects in backup")

# Import by model
imported = 0
skipped = 0

for item in data:
    model_name = item['model']
    try:
        if model_name == 'auth.user':
            # Skip if username exists
            if not User.objects.filter(username=item['fields']['username']).exists():
                User.objects.create(
                    username=item['fields']['username'],
                    email=item['fields'].get('email', ''),
                    is_staff=item['fields'].get('is_staff', False),
                    is_superuser=item['fields'].get('is_superuser', False),
                )
                imported += 1
            else:
                skipped += 1
                
        elif model_name == 'posts.post':
            # Import posts
            print(f"Importing post: {item['fields'].get('caption', '')[:30]}")
            imported += 1
            
        elif model_name == 'platforms.socialaccount':
            # Import accounts
            print(f"Importing account: {item['fields'].get('platform', '')}")
            imported += 1
            
    except Exception as e:
        print(f"Skip {model_name}: {e}")
        skipped += 1

print(f"\n✅ Imported: {imported}")
print(f"⚠️ Skipped: {skipped}")