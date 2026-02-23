# ai_video/views.py

import os
import io
import json
import uuid
import tempfile
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse, HttpResponse, FileResponse
from django.views.decorators.http import require_POST, require_GET
from django.contrib import messages
from django.conf import settings
from django.core.paginator import Paginator
from django.core.files.base import ContentFile

from .models import (
    UserVideoSettings, VideoLogo, VideoGeneration, 
    SavedVideo, VideoPromptTemplate
)
from .gemini_service import GeminiVideoService
from accounts.api_keys import get_gemini_key


def get_user_api_key(user):
    """Get user's Gemini API key - checks all sources via centralized lookup"""
    return get_gemini_key(user)


def get_or_create_video_settings(user):
    """Get or create video settings for user"""
    video_settings, created = UserVideoSettings.objects.get_or_create(user=user)
    return video_settings


# ============== API Settings ==============

@login_required
def api_settings(request):
    """Manage user's Gemini API settings"""
    
    video_settings = get_or_create_video_settings(request.user)
    
    if request.method == 'POST':
        action = request.POST.get('action')
        
        if action == 'save_key':
            api_key = request.POST.get('gemini_api_key', '').strip()
            if api_key:
                video_settings.set_gemini_api_key(api_key)
                video_settings.save()
                messages.success(request, 'API key saved successfully!')
            else:
                messages.error(request, 'Please enter an API key')
        
        elif action == 'update_defaults':
            video_settings.default_style = request.POST.get('default_style', 'realistic')
            video_settings.default_duration = int(request.POST.get('default_duration', 5))
            video_settings.default_resolution = request.POST.get('default_resolution', '1080p')
            video_settings.save()
            messages.success(request, 'Default settings updated!')
        
        elif action == 'delete_key':
            video_settings.set_gemini_api_key(None)
            video_settings.save()
            messages.success(request, 'API key deleted successfully!')
        
        elif action == 'test_key':
            api_key = video_settings.get_gemini_api_key()
            if api_key:
                service = GeminiVideoService(api_key=api_key)
                result = service.test_api_key()
                if result['success']:
                    messages.success(request, 'API key is working! ✓')
                else:
                    messages.error(request, f'API key test failed: {result.get("error", "Unknown error")}')
            else:
                messages.error(request, 'No API key set')
        
        return redirect('ai_video:api_settings')
    
    context = {
        'video_settings': video_settings,
    }
    
    return render(request, 'ai_video/api_settings.html', context)


# ============== Logo Management ==============

@login_required
def manage_logos(request):
    """Manage user's video logos"""
    
    logos = VideoLogo.objects.filter(user=request.user)
    
    if request.method == 'POST':
        action = request.POST.get('action')
        
        if action == 'upload':
            name = request.POST.get('name', 'My Logo')
            logo_file = request.FILES.get('logo_file')
            is_default = request.POST.get('is_default') == 'true'
            
            if logo_file:
                allowed_types = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
                if logo_file.content_type in allowed_types:
                    VideoLogo.objects.create(
                        user=request.user,
                        name=name,
                        logo_file=logo_file,
                        is_default=is_default
                    )
                    messages.success(request, 'Logo uploaded successfully!')
                else:
                    messages.error(request, 'Invalid file type. Please upload PNG, JPEG, GIF, or WebP.')
            else:
                messages.error(request, 'Please select a file to upload.')
        
        elif action == 'set_default':
            logo_id = request.POST.get('logo_id')
            logo = get_object_or_404(VideoLogo, pk=logo_id, user=request.user)
            VideoLogo.objects.filter(user=request.user).update(is_default=False)
            logo.is_default = True
            logo.save()
            messages.success(request, f'"{logo.name}" set as default logo.')
        
        elif action == 'delete':
            logo_id = request.POST.get('logo_id')
            logo = get_object_or_404(VideoLogo, pk=logo_id, user=request.user)
            logo.delete()
            messages.success(request, 'Logo deleted successfully.')
        
        return redirect('ai_video:manage_logos')
    
    context = {
        'logos': logos,
    }
    
    return render(request, 'ai_video/manage_logos.html', context)


# ============== Video Generator ==============

@login_required
def video_generator(request):
    """Main video generator page"""
    
    video_settings = get_or_create_video_settings(request.user)
    has_api_key = bool(get_user_api_key(request.user))

    # Get user's logos
    logos = VideoLogo.objects.filter(user=request.user)
    default_logo = logos.filter(is_default=True).first()
    
    # Get recent generations
    recent_generations = VideoGeneration.objects.filter(
        user=request.user,
        status='completed'
    ).order_by('-created_at')[:6]
    
    # Get prompt templates
    templates = VideoPromptTemplate.objects.filter(is_global=True)[:6]
    
    context = {
        'has_api_key': has_api_key,
        'video_settings': video_settings,
        'logos': logos,
        'default_logo': default_logo,
        'recent_generations': recent_generations,
        'templates': templates,
        'style_choices': VideoGeneration.STYLE_CHOICES,
        'duration_choices': VideoGeneration.DURATION_CHOICES,
        'resolution_choices': VideoGeneration.RESOLUTION_CHOICES,
        'aspect_ratio_choices': VideoGeneration.ASPECT_RATIO_CHOICES,
        'fps_choices': VideoGeneration.FPS_CHOICES,
        'position_choices': VideoGeneration.LOGO_POSITION_CHOICES,
    }
    
    return render(request, 'ai_video/generator.html', context)


@login_required
@require_POST
def generate_video_ajax(request):
    """AJAX endpoint for video generation"""
    
    try:
        # Check API key
        video_settings = get_or_create_video_settings(request.user)
        if not get_user_api_key(request.user):
            return JsonResponse({
                'success': False,
                'error': 'Please set your Gemini API key first.',
                'redirect': '/ai-video/settings/'
            })
        
        # Get form data
        title = request.POST.get('title', 'Untitled Video')
        prompt = request.POST.get('prompt', '')
        negative_prompt = request.POST.get('negative_prompt', '')
        style = request.POST.get('style', 'realistic')
        duration = int(request.POST.get('duration', 5))
        resolution = request.POST.get('resolution', '1080p')
        aspect_ratio = request.POST.get('aspect_ratio', '16:9')
        fps = int(request.POST.get('fps', 30))
        
        # Logo settings
        logo_id = request.POST.get('logo_id')
        logo_position = request.POST.get('logo_position', 'none')
        logo_size = int(request.POST.get('logo_size', 10))
        logo_opacity = int(request.POST.get('logo_opacity', 100))
        
        # Advanced settings
        camera_motion = request.POST.get('camera_motion', '')
        motion_intensity = request.POST.get('motion_intensity', '')
        enhance_prompt = request.POST.get('enhance_prompt', 'true') == 'true'
        seed = request.POST.get('seed')
        seed = int(seed) if seed else None
        
        if not prompt:
            return JsonResponse({'success': False, 'error': 'Please provide a prompt.'})
        
        # Get logo if specified
        logo = None
        if logo_id and logo_position != 'none':
            try:
                logo = VideoLogo.objects.get(pk=logo_id, user=request.user)
            except VideoLogo.DoesNotExist:
                pass
        
        # Create generation record
        generation = VideoGeneration.objects.create(
            user=request.user,
            title=title,
            prompt=prompt,
            negative_prompt=negative_prompt,
            style=style,
            duration=duration,
            resolution=resolution,
            aspect_ratio=aspect_ratio,
            fps=fps,
            logo=logo,
            logo_position=logo_position,
            logo_size=logo_size,
            logo_opacity=logo_opacity,
            camera_motion=camera_motion,
            motion_intensity=motion_intensity,
            enhance_prompt=enhance_prompt,
            seed=seed,
            status='processing'
        )
        
        # Generate video - use centralized key lookup
        api_key = get_user_api_key(request.user)
        service = GeminiVideoService(api_key=api_key)
        
        result = service.generate_video(
            prompt=prompt,
            style=style,
            duration=duration,
            resolution=resolution,
            aspect_ratio=aspect_ratio,
            fps=fps,
            negative_prompt=negative_prompt,
            camera_motion=camera_motion,
            motion_intensity=motion_intensity,
            enhance=enhance_prompt,
            seed=seed
        )
        
        if result['success']:
            # Save generated video
            video_data = result['video_data']
            video_format = result.get('format', 'mp4')
            filename = f"{uuid.uuid4().hex}.{video_format}"
            generation.generated_video.save(filename, ContentFile(video_data))
            generation.file_size = len(video_data)
            
            # Generate thumbnail
            try:
                thumb_filename = f"{uuid.uuid4().hex}.jpg"
                # Create thumbnail from first frame or middle
                service.generate_thumbnail(
                    generation.generated_video.path,
                    f"/tmp/{thumb_filename}"
                )
                with open(f"/tmp/{thumb_filename}", 'rb') as f:
                    generation.thumbnail.save(thumb_filename, ContentFile(f.read()))
                os.unlink(f"/tmp/{thumb_filename}")
            except:
                pass
            
            # Add logo if specified
            if logo and logo_position != 'none':
                try:
                    logo_output = f"/tmp/{uuid.uuid4().hex}_logo.mp4"
                    success = service.add_logo_to_video(
                        video_path=generation.generated_video.path,
                        logo_path=logo.logo_file.path,
                        output_path=logo_output,
                        position=logo_position,
                        size_percent=logo_size,
                        opacity=logo_opacity
                    )
                    if success:
                        with open(logo_output, 'rb') as f:
                            logo_filename = f"{uuid.uuid4().hex}_logo.mp4"
                            generation.generated_video_with_logo.save(logo_filename, ContentFile(f.read()))
                        os.unlink(logo_output)
                except Exception as e:
                    print(f"Logo error: {e}")
            
            generation.enhanced_prompt = result.get('enhanced_prompt', '')
            generation.processing_time = result.get('processing_time', 0)
            generation.status = 'completed'
            generation.save()
            
            # Update usage stats
            video_settings.total_videos_generated += 1
            video_settings.total_api_calls += 1
            video_settings.total_duration_generated += duration
            video_settings.save()
            
            return JsonResponse({
                'success': True,
                'generation_id': generation.pk,
                'video_url': generation.get_display_video().url if generation.get_display_video() else None,
                'thumbnail_url': generation.thumbnail.url if generation.thumbnail else None,
                'enhanced_prompt': generation.enhanced_prompt,
                'processing_time': round(generation.processing_time, 2)
            })
        else:
            generation.status = 'failed'
            generation.error_message = result.get('error', 'Unknown error')
            generation.save()
            
            return JsonResponse({
                'success': False,
                'error': result.get('error', 'Failed to generate video')
            })
            
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        })


@login_required
def video_result(request, pk):
    """View generated video result"""
    
    generation = get_object_or_404(VideoGeneration, pk=pk, user=request.user)
    
    context = {
        'generation': generation,
    }
    
    return render(request, 'ai_video/result.html', context)


@login_required
def download_video(request, pk):
    """Download generated video"""
    
    generation = get_object_or_404(VideoGeneration, pk=pk, user=request.user)
    
    video_field = generation.get_display_video()
    
    if not video_field:
        return HttpResponse("Video not found", status=404)
    
    response = FileResponse(open(video_field.path, 'rb'), content_type='video/mp4')
    filename = f"{generation.title.replace(' ', '_')}_{generation.pk}.mp4"
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    
    return response


# ============== History & Saved ==============

@login_required
def generation_history(request):
    """View generation history"""
    
    generations = VideoGeneration.objects.filter(user=request.user)
    
    # Filters
    status = request.GET.get('status')
    style = request.GET.get('style')
    
    if status:
        generations = generations.filter(status=status)
    if style:
        generations = generations.filter(style=style)
    
    # Pagination
    paginator = Paginator(generations, 12)
    page = request.GET.get('page')
    generations = paginator.get_page(page)
    
    context = {
        'generations': generations,
        'status_filter': status,
        'style_filter': style,
        'style_choices': VideoGeneration.STYLE_CHOICES,
    }
    
    return render(request, 'ai_video/history.html', context)


@login_required
def saved_videos(request):
    """View saved videos"""
    
    saved = SavedVideo.objects.filter(user=request.user)
    
    favorites_only = request.GET.get('favorites') == 'true'
    if favorites_only:
        saved = saved.filter(is_favorite=True)
    
    paginator = Paginator(saved, 12)
    page = request.GET.get('page')
    saved = paginator.get_page(page)
    
    context = {
        'saved_videos': saved,
        'favorites_only': favorites_only,
    }
    
    return render(request, 'ai_video/saved.html', context)


@login_required
@require_POST
def save_video(request):
    """Save a video to collection"""
    
    generation_id = request.POST.get('generation_id')
    
    generation = get_object_or_404(VideoGeneration, pk=generation_id, user=request.user)
    
    if SavedVideo.objects.filter(user=request.user, video_generation=generation).exists():
        return JsonResponse({'success': False, 'error': 'Video already saved'})
    
    saved = SavedVideo.objects.create(
        user=request.user,
        video_generation=generation,
        title=generation.title,
        video_file=generation.get_display_video(),
        thumbnail=generation.thumbnail,
        prompt=generation.prompt,
        duration=generation.duration,
        is_favorite=False
    )
    
    return JsonResponse({
        'success': True,
        'saved_id': saved.pk,
        'message': 'Video saved!'
    })


@login_required
@require_POST
def toggle_favorite_video(request, pk):
    """Toggle favorite status"""
    
    saved = get_object_or_404(SavedVideo, pk=pk, user=request.user)
    saved.is_favorite = not saved.is_favorite
    saved.save()
    
    return JsonResponse({
        'success': True,
        'is_favorite': saved.is_favorite
    })


@login_required
@require_POST
def delete_generation(request, pk):
    """Delete a generation"""
    
    generation = get_object_or_404(VideoGeneration, pk=pk, user=request.user)
    
    # Delete associated files
    if generation.generated_video:
        if os.path.exists(generation.generated_video.path):
            os.remove(generation.generated_video.path)
    if generation.generated_video_with_logo:
        if os.path.exists(generation.generated_video_with_logo.path):
            os.remove(generation.generated_video_with_logo.path)
    if generation.thumbnail:
        if os.path.exists(generation.thumbnail.path):
            os.remove(generation.thumbnail.path)
    
    generation.delete()
    
    return JsonResponse({'success': True, 'message': 'Deleted successfully'})


@login_required
@require_POST
def delete_saved_video(request, pk):
    """Delete a saved video"""
    
    saved = get_object_or_404(SavedVideo, pk=pk, user=request.user)
    saved.delete()
    
    return JsonResponse({'success': True, 'message': 'Deleted successfully'})
