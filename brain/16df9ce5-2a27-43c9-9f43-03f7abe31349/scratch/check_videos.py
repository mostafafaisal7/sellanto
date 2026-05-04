import os
import sys
import django

# Set up Django environment
sys.path.append('d:\\Projects\\Sellanto\\sellanto')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'socialsync.settings')
django.setup()

from ai_video.models import VideoGeneration

videos = VideoGeneration.objects.all()
print(f"Total Video Generations: {videos.count()}")
for v in videos:
    print(f"ID: {v.id}, User: {v.user.username}, Video: {v.generated_video}, Created: {v.created_at}")
