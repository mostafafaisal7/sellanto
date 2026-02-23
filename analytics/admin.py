# C:\Users\Trust computer\Desktop\Final_version_socialSync\analytics\admin.py

from django.contrib import admin

# Register your models here.
from django.contrib import admin
from .models import Analytics

@admin.register(Analytics)
class AnalyticsAdmin(admin.ModelAdmin):
    list_display = ['user', 'platform', 'metric_type', 'metric_value', 'post', 'recorded_at']
    list_filter = ['platform', 'metric_type']
    search_fields = ['user__username']
    readonly_fields = ['recorded_at', 'updated_at']
    date_hierarchy = 'recorded_at'