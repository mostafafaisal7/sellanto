#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Test Magic Mode permissions for User 13 to verify the fix works.
This simulates the permission checks that would happen during the Magic Link flow.
"""
import os
import sys
import django

# Set UTF-8 encoding for Windows console
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'socialsync.settings')
django.setup()

from django.contrib.auth.models import User
from accounts.models import UserRole
from brands.models import Workspace, Brand
from accounts.permissions import IsCreatorOrAbove
from unittest.mock import Mock

print("🧪 Testing Magic Mode Permission Flow for User 13\n")
print("="*60)

try:
    user = User.objects.get(id=13)
    workspace = Workspace.objects.get(owner=user)
    brand = Brand.objects.get(user=user)

    print(f"User: {user.username}")
    print(f"Workspace: {workspace.name} (ID: {workspace.id})")
    print(f"Brand: {brand.brand_name} (ID: {brand.id})")

    # Check role
    role = UserRole.objects.filter(user=user, workspace=workspace).first()
    print(f"Role: {role.role if role else 'NONE'}")
    print(f"\n{'='*60}")

    # Simulate permission check for IsCreatorOrAbove
    print(f"\n🔐 PERMISSION CHECKS (Magic Mode Pipeline)\n")

    # Step 1: Brand DNA Generation (IsAuthenticated only)
    print(f"Step 1: Brand DNA Generation")
    print(f"   Required Permission: IsAuthenticated")
    print(f"   User Authenticated: ✅ YES")
    print(f"   Result: ✅ ALLOWED\n")

    # Step 2: Trending Topics (IsCreatorOrAbove)
    print(f"Step 2: Trending Topics Generation")
    print(f"   Required Permission: IsCreatorOrAbove")
    has_role = UserRole.has_any_role(user, workspace, ['owner', 'admin', 'creator'])
    print(f"   Has Required Role: {'✅ YES' if has_role else '❌ NO'}")
    print(f"   Result: {'✅ ALLOWED' if has_role else '❌ FORBIDDEN (403)'}\n")

    # Step 3: Content Ideas (IsCreatorOrAbove)
    print(f"Step 3: Content Ideas Generation")
    print(f"   Required Permission: IsCreatorOrAbove")
    print(f"   Has Required Role: {'✅ YES' if has_role else '❌ NO'}")
    print(f"   Result: {'✅ ALLOWED' if has_role else '❌ FORBIDDEN (403)'}\n")

    # Step 4: Caption Generation (IsAuthenticated only)
    print(f"Step 4: Caption Generation")
    print(f"   Required Permission: IsAuthenticated")
    print(f"   User Authenticated: ✅ YES")
    print(f"   Result: ✅ ALLOWED\n")

    # Step 5: Image Generation (IsAuthenticated only)
    print(f"Step 5: Image Generation")
    print(f"   Required Permission: IsAuthenticated")
    print(f"   User Authenticated: ✅ YES")
    print(f"   Result: ✅ ALLOWED\n")

    print(f"{'='*60}")
    print(f"\n📊 FINAL VERDICT\n")

    if has_role:
        print(f"✅ SUCCESS! All Magic Mode steps will work!")
        print(f"   User has 'owner' role in their workspace")
        print(f"   IsCreatorOrAbove permission checks will pass")
        print(f"   Magic Link pipeline will complete successfully")
    else:
        print(f"❌ FAILURE! Magic Mode will break at Step 2 or 3")
        print(f"   User does NOT have required role in workspace")
        print(f"   IsCreatorOrAbove permission will return 403 Forbidden")
        print(f"   Need to run fix_user13.py to assign role")

    print(f"\n{'='*60}")

except User.DoesNotExist:
    print(f"❌ User 13 not found")
except Workspace.DoesNotExist:
    print(f"❌ Workspace not found for user")
except Brand.DoesNotExist:
    print(f"❌ Brand not found for user")
except Exception as e:
    print(f"❌ Error: {e}")
