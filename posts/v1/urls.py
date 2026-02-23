# C:\Users\Trust computer\Desktop\Final_version_socialSync\posts\urls.py

from django.urls import path
from . import views

urlpatterns = [
    path('create/', views.create_post, name='create_post'),
    path('my-posts/', views.my_posts, name='my_posts'),
    path('edit/<int:post_id>/', views.edit_post, name='edit_post'),
    path('delete/<int:post_id>/', views.delete_post, name='delete_post'),
    path('cancel/<int:post_id>/', views.cancel_post, name='cancel_post'),
    path('generate-caption/', views.generate_caption, name='generate_caption'),
]