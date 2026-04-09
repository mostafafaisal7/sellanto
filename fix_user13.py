#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Fix User ID 13 by assigning owner role to their workspace"""
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
from brands.models import Workspace

try:
    user = User.objects.get(id=13)
    workspace = Workspace.objects.get(owner=user)

    print(f"User: {user.username}")
    print(f"Workspace: {workspace.name} (ID: {workspace.id})")

    # Check if role already exists
    existing_role = UserRole.objects.filter(user=user, workspace=workspace, role='owner').first()

    if existing_role:
        print(f"\n✅ User already has 'owner' role in workspace!")
    else:
        print(f"\n🔧 Creating 'owner' role for user in workspace...")
        UserRole.objects.create(
            user=user,
            workspace=workspace,
            role='owner',
            granted_by=user  # Self-granted since they're the workspace owner
        )
        print(f"✅ SUCCESS! User now has 'owner' role in workspace {workspace.id}")
        print(f"\n🎉 Magic Link should work now!")
        print(f"   User can now:")
        print(f"   - Generate trending topics")
        print(f"   - Generate content ideas")
        print(f"   - Complete the full Magic Mode pipeline")

except User.DoesNotExist:
    print(f"❌ User with ID 13 does not exist!")
except Workspace.DoesNotExist:
    print(f"❌ No workspace found for user!")
except Exception as e:
    print(f"❌ Error: {e}")
