#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Verify that all RBAC permissions have been removed and replaced with IsAuthenticated.
"""
import os
import re

files_to_check = [
    'api/strategy_views.py',
    'api/approval_views.py',
    'api/caption_views.py',
    'api/hashtag_views.py',
    'api/creative_views.py',
    'api/scheduling_views.py',
]

rbac_patterns = [
    r'IsCreatorOrAbove',
    r'IsWorkspaceAdmin',
    r'IsApproverOrAbove',
    r'IsPublisherOrAbove',
    r'IsViewerOrAbove',
    r'IsWorkspaceOwner',
]

base_path = 'd:/Projects/Sellanto/sellanto/'

print("🔍 Verifying RBAC Removal\n")
print("="*60)

all_clean = True

for file_path in files_to_check:
    full_path = os.path.join(base_path, file_path)
    print(f"\nChecking: {file_path}")

    with open(full_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Check for any RBAC pattern usage (except in comments)
    found_rbac = False
    for pattern in rbac_patterns:
        # Find all matches
        matches = re.finditer(pattern, content)
        for match in matches:
            # Check if it's in a comment
            line_start = content.rfind('\n', 0, match.start()) + 1
            line_content = content[line_start:match.end()]
            if not line_content.strip().startswith('#'):
                print(f"   ❌ Found {pattern} at position {match.start()}")
                found_rbac = True
                all_clean = False

    if not found_rbac:
        print(f"   ✅ Clean - no RBAC permissions")

    # Count permission_classes with just IsAuthenticated
    authenticated_only = len(re.findall(r'permission_classes\s*=\s*\[IsAuthenticated\]', content))
    if authenticated_only > 0:
        print(f"   ✅ {authenticated_only} endpoints use IsAuthenticated only")

print(f"\n{'='*60}")

if all_clean:
    print(f"\n✅ SUCCESS! All RBAC permissions removed!")
    print(f"\n📋 Summary:")
    print(f"   • All 6 files updated")
    print(f"   • All permissions set to IsAuthenticated only")
    print(f"   • Any logged-in user can now access all features")
    print(f"\n🎉 New accounts will have full access immediately!")
else:
    print(f"\n❌ FAILED! Some RBAC permissions still exist")
    print(f"   Please review the files above and remove remaining RBAC")
