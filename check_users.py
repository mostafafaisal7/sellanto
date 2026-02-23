import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'socialsync.settings')
django.setup()

from django.contrib.auth.models import User
from accounts.models import UserProfile

print("User approval status:")
for user in User.objects.all():
    is_approved = "N/A"
    if hasattr(user, 'profile'):
        is_approved = user.profile.is_approved
    print(f"Username: {user.username}, Is Superuser: {user.is_superuser}, Is Approved: {is_approved}")
