# video_studio/urls.py

from django.urls import path
from . import views

app_name = 'video_studio'

urlpatterns = [
    # Project Management
    path('projects/', views.list_projects, name='list_projects'),
    path('projects/create/', views.create_project, name='create_project'),
    path('projects/<int:project_id>/', views.get_project_detail, name='project_detail'),

    # Clip Generation
    path('clips/generate/', views.generate_single_clip, name='generate_single_clip'),
    path('clips/batch-generate/', views.batch_generate_clips, name='batch_generate_clips'),
    path('clips/<int:clip_id>/status/', views.get_clip_status, name='clip_status'),

    # Clip Management
    path('clips/select/', views.update_clip_selection, name='update_clip_selection'),
    path('clips/reorder/', views.reorder_clips, name='reorder_clips'),

    # Video Merging
    path('merge/', views.merge_selected_clips, name='merge_clips'),
    path('merge/<int:merged_video_id>/status/', views.get_merged_video_status, name='merged_video_status'),

    # Download
    path('clips/<int:clip_id>/download/', views.download_clip, name='download_clip'),
    path('merge/<int:merged_video_id>/download/', views.download_merged_video, name='download_merged_video'),

    # Templates
    path('templates/', views.list_templates, name='list_templates'),

    # Utilities
    path('test-api-key/', views.test_api_key, name='test_api_key'),
]
