import os
import sys
import django
import json
from datetime import datetime

# Set up Django environment
sys.path.append('d:\\Projects\\Sellanto\\sellanto')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'socialsync.settings')
django.setup()

from django.contrib.auth.models import User
from django.test import RequestFactory
from api.views import MagicHistoryView

user = User.objects.get(username='customo@new.com')
factory = RequestFactory()
request = factory.get('/api/v1/magic/history/', HTTP_HOST='127.0.0.1:8000')
request.user = user

view = MagicHistoryView.as_view()
response = view(request)

print(f"Status Code: {response.status_code}")
data = response.data
print(f"Total Sessions: {len(data['sessions'])}")
for i, s in enumerate(data['sessions']):
    # Safely get videos, as it might not be in response if logic failed
    videos = s.get('videos', [])
    posts = s.get('posts', [])
    stats = s.get('stats', {})
    print(f"Session {i}: Date {s['date']}, Videos: {len(videos)}, Posts: {len(posts)}, Stats: {stats}")
