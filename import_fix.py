"""
Fix import by removing UserProfile from JSON
"""
import json

print("🔧 Fixing data_backup.json...")

# Load JSON
with open('data_backup.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f"Original objects: {len(data)}")

# Remove UserProfile entries (they'll be auto-created by signal)
filtered_data = [item for item in data if item['model'] != 'accounts.userprofile']

print(f"After removing profiles: {len(filtered_data)}")
print(f"Removed {len(data) - len(filtered_data)} profile entries")

# Save cleaned JSON
with open('data_backup_clean.json', 'w', encoding='utf-8') as f:
    json.dump(filtered_data, f, indent=2, ensure_ascii=False)

print("✅ Created: data_backup_clean.json")
print("📥 Now run: python manage.py loaddata data_backup_clean.json")