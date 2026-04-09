#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Fix all users who own workspaces but don't have 'owner' role assigned.
This is a migration script to fix existing data after the bug fix.
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
from brands.models import Workspace

print("🔍 Scanning for workspaces without owner roles...\n")

workspaces = Workspace.objects.all()
fixed_count = 0
already_ok_count = 0

for workspace in workspaces:
    owner = workspace.owner

    # Check if owner has 'owner' role in this workspace
    existing_role = UserRole.objects.filter(
        user=owner,
        workspace=workspace,
        role='owner'
    ).first()

    if existing_role:
        already_ok_count += 1
        print(f"✅ Workspace '{workspace.name}' (ID: {workspace.id}) - User '{owner.username}' already has 'owner' role")
    else:
        # Create the missing role
        UserRole.objects.create(
            user=owner,
            workspace=workspace,
            role='owner',
            granted_by=owner
        )
        fixed_count += 1
        print(f"🔧 FIXED: Workspace '{workspace.name}' (ID: {workspace.id}) - Assigned 'owner' role to user '{owner.username}'")

print(f"\n{'='*60}")
print(f"📊 SUMMARY")
print(f"{'='*60}")
print(f"Total workspaces: {workspaces.count()}")
print(f"Already OK: {already_ok_count}")
print(f"Fixed: {fixed_count}")

if fixed_count > 0:
    print(f"\n✅ Successfully fixed {fixed_count} workspace(s)!")
    print(f"   All users should now be able to use Magic Mode and other RBAC-protected features.")
else:
    print(f"\n✅ All workspaces already have correct role assignments. Nothing to fix!")
