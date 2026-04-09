#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Script to remove all RBAC permission checks and replace with IsAuthenticated only.
This makes the system open - anyone with an account can do anything.
"""
import os
import re

files_to_fix = [
    'api/approval_views.py',
    'api/caption_views.py',
    'api/hashtag_views.py',
    'api/creative_views.py',
    'api/scheduling_views.py',
    'api/strategy_views.py',
]

rbac_permissions = [
    'IsCreatorOrAbove',
    'IsWorkspaceAdmin',
    'IsApproverOrAbove',
    'IsPublisherOrAbove',
    'IsViewerOrAbove',
    'IsWorkspaceOwner',
]

base_path = 'd:/Projects/Sellanto/sellanto/'

for file_path in files_to_fix:
    full_path = os.path.join(base_path, file_path)

    print(f"\n🔧 Processing: {file_path}")

    with open(full_path, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    # Remove RBAC imports
    for perm in rbac_permissions:
        content = re.sub(rf',\s*{perm}', '', content)
        content = re.sub(rf'{perm},\s*', '', content)
        content = re.sub(rf'{perm}', '', content)

    # Clean up import statements - remove empty imports
    content = re.sub(r'from accounts\.permissions import\s*\)', 'pass  # RBAC removed', content)
    content = re.sub(r'from accounts\.permissions import\s*$', '', content, flags=re.MULTILINE)

    # Replace permission_classes with just IsAuthenticated
    # Pattern: permission_classes = [IsAuthenticated, SomeRBACPermission]
    # Replace with: permission_classes = [IsAuthenticated]
    content = re.sub(
        r'permission_classes\s*=\s*\[IsAuthenticated,\s*[^\]]+\]',
        'permission_classes = [IsAuthenticated]',
        content
    )

    if content != original_content:
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"   ✅ Updated!")
    else:
        print(f"   ℹ️  No changes needed")

print(f"\n{'='*60}")
print(f"✅ All RBAC permissions removed!")
print(f"   Now anyone with an account can use all features.")
print(f"{'='*60}\n")
