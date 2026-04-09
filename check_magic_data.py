#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Check Magic Mode data for User 13"""
import os
import sys
import django

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'socialsync.settings')
django.setup()

from django.contrib.auth.models import User
from brands.models import Brand, ContentIdea, TrendingCache
from ai_caption.models import CaptionGeneration
from ai_image.models import ImageGeneration
from posts.models import Post

user = User.objects.get(id=13)
brand = Brand.objects.filter(user=user).first()

print(f"User: {user.username}")
print(f"Brand: {brand.brand_name if brand else 'None'}")
print(f"Brand ID: {brand.id if brand else 'N/A'}")
print(f"\n=== Magic Mode Data ===\n")

# Check for content ideas
ideas = ContentIdea.objects.filter(user=user).order_by('-created_at')[:5]
print(f"Content Ideas: {ideas.count()} total")
for idea in ideas:
    print(f"  - {idea.title} ({idea.platform}, {idea.created_at})")

# Check for captions
captions = CaptionGeneration.objects.filter(user=user).order_by('-created_at')[:5]
print(f"\nCaptions Generated: {captions.count()} total")
for cap in captions:
    print(f"  - {cap.input_text[:50]}... ({cap.status}, {cap.created_at})")

# Check for images
images = ImageGeneration.objects.filter(user=user).order_by('-created_at')[:5]
print(f"\nImages Generated: {images.count()} total")
for img in images:
    print(f"  - {img.title} ({img.status}, {img.created_at})")

# Check for trending
if brand:
    trending = TrendingCache.objects.filter(brand=brand).order_by('-fetched_at')[:5]
    print(f"\nTrending Topics: {trending.count()} total")
    for t in trending:
        print(f"  - {t.topic} ({t.platform}, {t.fetched_at})")

# Check for Magic Mode posts
magic_posts = Post.objects.filter(user=user, source='magic').order_by('-created_at')[:5]
print(f"\nMagic Mode Posts: {magic_posts.count()} total")
for post in magic_posts:
    print(f"  - {post.caption[:50] if post.caption else 'No caption'}... ({post.status}, {post.created_at})")

print(f"\n=== Diagnosis ===")
if ideas.count() == 0:
    print("❌ No content ideas - Ideas generation likely failed")
if captions.count() == 0:
    print("❌ No captions - Caption generation likely failed")
if images.count() == 0:
    print("❌ No images - Image generation likely failed")
if magic_posts.count() == 0:
    print("❌ No magic posts - Full pipeline didn't complete")
