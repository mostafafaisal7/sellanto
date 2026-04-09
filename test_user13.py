#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Test script to check User ID 13 Magic Link issues"""
import os
import sys
import django

# Set UTF-8 encoding for Windows console
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'socialsync.settings')
django.setup()

from django.contrib.auth.models import User
from accounts.models import UserProfile, UserRole
from brands.models import Workspace, Brand

try:
    user = User.objects.get(id=13)
    print(f"✅ User Found")
    print(f"   Username: {user.username}")
    print(f"   Email: {user.email}")
    print(f"   Date Joined: {user.date_joined}")

    # Check profile
    try:
        profile = UserProfile.objects.get(user=user)
        print(f"\n✅ User Profile")
        print(f"   Approved: {profile.is_approved}")
        print(f"   Phone: {profile.phone}")
        print(f"   Company: {profile.company}")
    except UserProfile.DoesNotExist:
        print(f"\n❌ User Profile NOT FOUND")

    # Check workspaces
    workspaces = Workspace.objects.filter(owner=user)
    print(f"\n📁 Workspaces (owner): {workspaces.count()}")
    if workspaces.exists():
        for ws in workspaces:
            print(f"   ✅ {ws.name} (ID: {ws.id})")
    else:
        print(f"   ❌ NO WORKSPACES FOUND - THIS IS THE PROBLEM!")

    # Check brands
    brands = Brand.objects.filter(user=user)
    print(f"\n🏢 Brands: {brands.count()}")
    if brands.exists():
        for b in brands:
            print(f"   - {b.brand_name} (ID: {b.id})")
            print(f"     Workspace: {b.workspace_id if b.workspace else 'None'}")
            print(f"     Has DNA: {'Yes' if b.brand_dna else 'No'}")
    else:
        print(f"   ❌ NO BRANDS FOUND")

    # Check user roles
    roles = UserRole.objects.filter(user=user)
    print(f"\n👤 User Roles: {roles.count()}")
    if roles.exists():
        for r in roles:
            print(f"   - {r.role} in Workspace {r.workspace_id} (Workspace Name: {r.workspace.name})")
    else:
        print(f"   ❌ NO USER ROLES FOUND - THIS WILL BLOCK IsCreatorOrAbove permissions!")

    # Diagnosis
    print(f"\n" + "="*60)
    print(f"🔍 DIAGNOSIS")
    print(f"="*60)

    if workspaces.count() == 0:
        print(f"❌ CRITICAL: User has NO workspace!")
        print(f"   → This means user registered via /api/auth/register/")
        print(f"   → NOT via /api/auth/register-with-brand/")
        print(f"   → Magic Mode will fail at ideas generation (IsCreatorOrAbove)")

    if roles.count() == 0:
        print(f"❌ CRITICAL: User has NO roles assigned!")
        print(f"   → Even if workspace exists, user needs 'owner', 'admin', or 'creator' role")
        print(f"   → /api/ideas/generate/ will return 403 Forbidden")

    if brands.count() == 0:
        print(f"⚠️  WARNING: User has no brands")
        print(f"   → Magic Mode will try to create a brand in Step 0")
        print(f"   → But without workspace, brand creation might fail or be orphaned")

    print(f"\n💡 SOLUTION:")
    print(f"   1. Create a workspace for this user")
    print(f"   2. Assign 'owner' role to user in that workspace")
    print(f"   3. Link any existing brands to the workspace")

except User.DoesNotExist:
    print(f"❌ User with ID 13 does NOT exist!")
