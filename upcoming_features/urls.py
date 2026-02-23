from django.urls import path
from . import views

urlpatterns = [
    path('ai-image-generator/', views.ai_image_generator, name='ai_image_generator'),
    path('ai-video-generator/', views.ai_video_generator, name='ai_video_generator'),
    path('ai-chatbot/', views.ai_chatbot, name='ai_chatbot'),
    path('ai-reply-bot/', views.ai_reply_bot, name='ai_reply_bot'),
]