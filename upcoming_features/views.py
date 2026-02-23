from django.shortcuts import render
from django.contrib.auth.decorators import login_required


@login_required
def ai_image_generator(request):
    """AI Ad Image Generator - Coming Soon"""
    return render(request, 'upcoming_features/ai_image_generator.html')


@login_required
def ai_video_generator(request):
    """AI Ad Video Generator - Coming Soon"""
    return render(request, 'upcoming_features/ai_video_generator.html')


@login_required
def ai_chatbot(request):
    """AI Message Automation Chatbot - Coming Soon"""
    return render(request, 'upcoming_features/ai_chatbot.html')


@login_required
def ai_reply_bot(request):
    """AI Comment Reply Bot - Coming Soon"""
    return render(request, 'upcoming_features/ai_reply_bot.html')