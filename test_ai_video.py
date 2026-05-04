"""
Simple test script to check if ai_video view works
Run: python manage.py shell < test_ai_video.py
"""

from django.test import RequestFactory
from django.contrib.auth.models import User
from ai_video.views import video_generator

# Create test request
factory = RequestFactory()
request = factory.get('/ai-video/')

# Get or create test user
user, _ = User.objects.get_or_create(username='testuser')
request.user = user

# Try calling the view
try:
    response = video_generator(request)
    print(f"✅ View works! Status: {response.status_code}")
    if response.status_code == 200:
        print("✅ Page renders successfully")
    else:
        print(f"⚠️  Unexpected status code: {response.status_code}")
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
