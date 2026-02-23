import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'socialsync.settings')
django.setup()

from django.contrib.auth.models import User
from accounts.models import UserProfile

print("Approving all users...")
profiles = UserProfile.objects.all()
count = 0
for profile in profiles:
    if not profile.is_approved:
        profile.is_approved = True
        profile.save()
        print(f"User approved: {profile.user.username}")
        count += 1

print(f"Successfully approved {count} users.")
