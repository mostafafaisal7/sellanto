# ai_voice/views.py

import os
import time
import json
import base64
from pathlib import Path
from datetime import datetime

from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse, FileResponse, Http404
from django.views.decorators.http import require_http_methods
from django.conf import settings
from django.core.files.base import ContentFile

from .models import VoiceGeneration, UserVoiceSettings
from accounts.api_keys import get_openai_key

# Try to import OpenAI
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False


def get_user_settings(user):
    """Get or create user voice settings"""
    settings_obj, created = UserVoiceSettings.objects.get_or_create(user=user)
    return settings_obj


def get_openai_client(user):
    """Get OpenAI client with user's API key - uses centralized lookup"""
    api_key = get_openai_key(user)

    if not api_key:
        return None

    return OpenAI(api_key=api_key)


@login_required
def generator(request):
    """Main voice generator page"""
    user_settings = get_user_settings(request.user)
    
    # Check if API key is configured - uses centralized lookup
    has_api_key = bool(get_openai_key(request.user))
    
    # Get recent generations for quick access
    recent_generations = VoiceGeneration.objects.filter(
        user=request.user,
        status='completed'
    ).order_by('-created_at')[:5]
    
    context = {
        'user_settings': user_settings,
        'has_api_key': has_api_key,
        'recent_generations': recent_generations,
        'voice_choices': VoiceGeneration.VOICE_CHOICES,
        'model_choices': VoiceGeneration.MODEL_CHOICES,
        'format_choices': VoiceGeneration.FORMAT_CHOICES,
        'MEDIA_URL': settings.MEDIA_URL,
    }
    
    return render(request, 'ai_voice/generator.html', context)


@login_required
@require_http_methods(["POST"])
def generate_voice(request):
    """API endpoint to generate voice from text"""
    start_time = time.time()
    
    try:
        # Get input data
        input_text = request.POST.get('text', '').strip()
        title = request.POST.get('title', '').strip()
        voice = request.POST.get('voice', 'alloy')
        model = request.POST.get('model', 'tts-1')
        speed = float(request.POST.get('speed', 1.0))
        output_format = request.POST.get('format', 'mp3')
        
        # Validate
        if not input_text:
            return JsonResponse({'error': 'Text is required'}, status=400)
        
        if len(input_text) > 4096:
            return JsonResponse({'error': 'Text too long. Maximum 4096 characters.'}, status=400)
        
        if speed < 0.25 or speed > 4.0:
            return JsonResponse({'error': 'Speed must be between 0.25 and 4.0'}, status=400)
        
        # Get OpenAI client
        client = get_openai_client(request.user)
        if not client:
            return JsonResponse({'error': 'OpenAI API key not configured. Please add your API key in Settings.'}, status=400)
        
        # Create generation record
        generation = VoiceGeneration.objects.create(
            user=request.user,
            title=title or f"Voice {datetime.now().strftime('%Y%m%d_%H%M%S')}",
            input_text=input_text,
            voice=voice,
            model=model,
            speed=speed,
            output_format=output_format,
            characters_used=len(input_text),
            status='processing'
        )
        
        try:
            # Generate speech using OpenAI TTS
            response = client.audio.speech.create(
                model=model,
                voice=voice,
                input=input_text,
                speed=speed,
                response_format=output_format
            )
            
            # Save audio file
            filename = f"voice_{generation.id}_{voice}_{int(time.time())}.{output_format}"
            audio_content = response.content
            
            # Save to file
            generation.audio_file.save(filename, ContentFile(audio_content), save=False)
            generation.file_size_bytes = len(audio_content)
            generation.status = 'completed'
            generation.processing_time = time.time() - start_time
            generation.save()
            
            # Update user stats
            user_settings = get_user_settings(request.user)
            user_settings.total_characters_used += len(input_text)
            user_settings.total_generations += 1
            user_settings.save()
            
            return JsonResponse({
                'success': True,
                'generation_id': generation.id,
                'audio_url': generation.audio_file.url,
                'title': generation.title,
                'voice': voice,
                'characters': len(input_text),
                'processing_time': round(generation.processing_time, 2)
            })
            
        except Exception as e:
            generation.status = 'failed'
            generation.error_message = str(e)
            generation.processing_time = time.time() - start_time
            generation.save()
            return JsonResponse({'error': f'Generation failed: {str(e)}'}, status=500)
            
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required
def history(request):
    """View generation history"""
    generations = VoiceGeneration.objects.filter(user=request.user).order_by('-created_at')
    
    # Stats
    total_generations = generations.count()
    completed_generations = generations.filter(status='completed').count()
    total_characters = sum(g.characters_used for g in generations)
    
    # Filter by status
    status_filter = request.GET.get('status', '')
    if status_filter:
        generations = generations.filter(status=status_filter)
    
    # Filter by voice
    voice_filter = request.GET.get('voice', '')
    if voice_filter:
        generations = generations.filter(voice=voice_filter)
    
    context = {
        'generations': generations[:100],  # Limit to 100
        'total_generations': total_generations,
        'completed_generations': completed_generations,
        'total_characters': total_characters,
        'status_filter': status_filter,
        'voice_filter': voice_filter,
        'voice_choices': VoiceGeneration.VOICE_CHOICES,
        'MEDIA_URL': settings.MEDIA_URL,
    }
    
    return render(request, 'ai_voice/history.html', context)


@login_required
def voice_settings(request):
    """Voice settings page"""
    user_settings = get_user_settings(request.user)
    
    if request.method == 'POST':
        api_key = request.POST.get('api_key', '').strip()
        default_voice = request.POST.get('default_voice', 'alloy')
        default_speed = float(request.POST.get('default_speed', 1.0))
        default_model = request.POST.get('default_model', 'tts-1')
        
        user_settings.openai_api_key = api_key
        user_settings.default_voice = default_voice
        user_settings.default_speed = default_speed
        user_settings.default_model = default_model
        user_settings.save()
        
        return redirect('ai_voice:settings')
    
    # Mask API key for display
    masked_key = ''
    if user_settings.openai_api_key:
        key = user_settings.openai_api_key
        if len(key) > 8:
            masked_key = key[:4] + '*' * (len(key) - 8) + key[-4:]
        else:
            masked_key = '****'
    
    context = {
        'user_settings': user_settings,
        'masked_key': masked_key,
        'voice_choices': VoiceGeneration.VOICE_CHOICES,
        'model_choices': VoiceGeneration.MODEL_CHOICES,
    }
    
    return render(request, 'ai_voice/settings.html', context)


@login_required
def delete_generation(request, generation_id):
    """Delete a voice generation"""
    if request.method == 'POST':
        generation = get_object_or_404(VoiceGeneration, id=generation_id, user=request.user)
        
        # Delete audio file if exists
        if generation.audio_file:
            try:
                generation.audio_file.delete(save=False)
            except:
                pass
        
        generation.delete()
        
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({'success': True})
        
        return redirect('ai_voice:history')
    
    return JsonResponse({'error': 'Invalid method'}, status=400)


@login_required
def download_audio(request, generation_id):
    """Download audio file"""
    generation = get_object_or_404(VoiceGeneration, id=generation_id, user=request.user)
    
    if not generation.audio_file:
        raise Http404("Audio file not found")
    
    response = FileResponse(
        generation.audio_file.open('rb'),
        content_type=f'audio/{generation.output_format}'
    )
    response['Content-Disposition'] = f'attachment; filename="{generation.title}.{generation.output_format}"'
    
    return response


@login_required
def regenerate(request, generation_id):
    """Regenerate audio with same settings"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Invalid method'}, status=400)
    
    original = get_object_or_404(VoiceGeneration, id=generation_id, user=request.user)
    
    # Create new request with same parameters
    from django.test import RequestFactory
    factory = RequestFactory()
    new_request = factory.post('/generate/', {
        'text': original.input_text,
        'title': f"{original.title} (Regenerated)",
        'voice': original.voice,
        'model': original.model,
        'speed': original.speed,
        'format': original.output_format,
    })
    new_request.user = request.user
    new_request.POST = new_request.POST.copy()
    
    return generate_voice(new_request)


@login_required
def get_generation(request, generation_id):
    """Get generation details as JSON"""
    generation = get_object_or_404(VoiceGeneration, id=generation_id, user=request.user)
    
    return JsonResponse({
        'id': generation.id,
        'title': generation.title,
        'input_text': generation.input_text,
        'voice': generation.voice,
        'model': generation.model,
        'speed': generation.speed,
        'format': generation.output_format,
        'audio_url': generation.audio_file.url if generation.audio_file else None,
        'status': generation.status,
        'characters': generation.characters_used,
        'processing_time': generation.processing_time,
        'created_at': generation.created_at.isoformat(),
    })


# ============ Voice Preview (Text-to-Speech Preview without saving) ============

@login_required
@require_http_methods(["POST"])
def preview_voice(request):
    """Preview voice without saving - limited to 100 characters"""
    try:
        text = request.POST.get('text', '').strip()[:100]  # Limit preview to 100 chars
        voice = request.POST.get('voice', 'alloy')
        speed = float(request.POST.get('speed', 1.0))
        
        if not text:
            return JsonResponse({'error': 'Text required'}, status=400)
        
        client = get_openai_client(request.user)
        if not client:
            return JsonResponse({'error': 'API key not configured'}, status=400)
        
        # Generate preview audio
        response = client.audio.speech.create(
            model='tts-1',  # Use standard model for preview
            voice=voice,
            input=text,
            speed=speed,
            response_format='mp3'
        )
        
        # Return as base64
        audio_base64 = base64.b64encode(response.content).decode('utf-8')
        
        return JsonResponse({
            'success': True,
            'audio_base64': audio_base64,
            'content_type': 'audio/mp3'
        })
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
