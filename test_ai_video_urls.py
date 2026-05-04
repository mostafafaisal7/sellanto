"""
Quick diagnostic script for ai_video
Run in Django shell: python manage.py shell
Then: exec(open('test_ai_video_urls.py').read())
"""

print("=" * 60)
print("DIAGNOSTIC: AI Video App")
print("=" * 60)

# Test 1: Check if ai_video is in INSTALLED_APPS
from django.conf import settings
print(f"\n1. ai_video in INSTALLED_APPS: {'ai_video' in settings.INSTALLED_APPS}")

# Test 2: Check URL patterns
try:
    from django.urls import reverse
    url = reverse('ai_video:generator')
    print(f"2. ai_video:generator URL: ✅ {url}")
except Exception as e:
    print(f"2. ai_video:generator URL: ❌ {e}")

# Test 3: Check if view exists
try:
    from ai_video.views import video_generator
    print(f"3. video_generator view: ✅ Imported successfully")
except Exception as e:
    print(f"3. video_generator view: ❌ {e}")

# Test 4: Check if models import
try:
    from ai_video.models import VideoGeneration
    print(f"4. VideoGeneration model: ✅ Imported successfully")
except Exception as e:
    print(f"4. VideoGeneration model: ❌ {e}")

# Test 5: Check brands models import
try:
    from brands.models import Workspace, Brand
    print(f"5. Brands models: ✅ Imported successfully")
except Exception as e:
    print(f"5. Brands models: ❌ {e}")

# Test 6: Check if template exists
import os
template_path = os.path.join(settings.BASE_DIR, 'ai_video', 'templates', 'ai_video', 'generator.html')
print(f"6. Template exists: {'✅' if os.path.exists(template_path) else '❌'} {template_path}")

# Test 7: Try to render template
try:
    from django.template.loader import get_template
    template = get_template('ai_video/generator.html')
    print(f"7. Template loads: ✅ Template found and loaded")
except Exception as e:
    print(f"7. Template loads: ❌ {e}")

print("\n" + "=" * 60)
print("RECOMMENDATION:")
print("=" * 60)
print("Based on errors above, check the failing component.")
print("If all tests pass, the issue is likely:")
print("- Not logged in (page redirects to login)")
print("- base.html has broken URL tags")
print("- JavaScript error on page")
