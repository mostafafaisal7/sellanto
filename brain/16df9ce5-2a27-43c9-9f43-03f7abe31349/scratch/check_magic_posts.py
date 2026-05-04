import os
import sys
import django

# Set up Django environment
sys.path.append('d:\\Projects\\Sellanto\\sellanto')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'socialsync.settings')
django.setup()

from posts.models import Post

posts = Post.objects.filter(source='magic')
print(f"Total Magic Posts: {posts.count()}")
for p in posts:
    print(f"ID: {p.id}, Media: {p.media_files}, Status: {p.status}")
