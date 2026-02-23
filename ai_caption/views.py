# ai_caption/views.py

import os
import json
import time
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_POST, require_GET
from django.contrib import messages
from django.conf import settings
from django.core.paginator import Paginator

from .models import CaptionGeneration, CaptionTemplate, SavedCaption, UserAPISettings
from .forms import (
    CaptionGenerationForm, QuickCaptionForm, RegenerateCaptionForm,
    CaptionTemplateForm, SaveCaptionForm, VariationsForm
)
from .openai_service import CaptionGeneratorService
from accounts.api_keys import get_openai_key


def get_user_api_key(user):
    """Get user's OpenAI API key - checks all sources via centralized lookup"""
    return get_openai_key(user)


def get_or_create_api_settings(user):
    """Get or create API settings for user"""
    api_settings, created = UserAPISettings.objects.get_or_create(user=user)
    return api_settings


@login_required
def api_settings(request):
    """Manage user's API settings"""
    
    api_settings = get_or_create_api_settings(request.user)
    
    if request.method == 'POST':
        action = request.POST.get('action')
        
        if action == 'save_key':
            api_key = request.POST.get('openai_api_key', '').strip()
            if api_key:
                # Validate API key format
                if not api_key.startswith('sk-'):
                    messages.error(request, 'Invalid API key format. OpenAI API keys start with "sk-"')
                else:
                    api_settings.set_openai_api_key(api_key)
                    api_settings.save()
                    messages.success(request, 'API key saved successfully!')
            else:
                messages.error(request, 'Please enter an API key')
        
        elif action == 'update_model':
            model = request.POST.get('default_model', 'gpt-4o')
            api_settings.default_model = model
            api_settings.save()
            messages.success(request, 'Default model updated!')
        
        elif action == 'delete_key':
            api_settings.set_openai_api_key(None)
            api_settings.save()
            messages.success(request, 'API key deleted successfully!')
        
        elif action == 'test_key':
            # Test the API key
            api_key = api_settings.get_openai_api_key()
            if api_key:
                service = CaptionGeneratorService(api_key=api_key)
                result = service.generate_from_text(
                    topic="Test",
                    tone="friendly",
                    length="short"
                )
                if result['success']:
                    messages.success(request, 'API key is working! ✓')
                else:
                    messages.error(request, f'API key test failed: {result.get("error", "Unknown error")}')
            else:
                messages.error(request, 'No API key set')
        
        return redirect('ai_caption:api_settings')
    
    context = {
        'api_settings': api_settings,
    }
    
    return render(request, 'ai_caption/api_settings.html', context)


@login_required
@require_POST
def api_settings_ajax(request):
    """AJAX endpoint for API settings"""
    
    api_settings = get_or_create_api_settings(request.user)
    action = request.POST.get('action')
    
    if action == 'save_key':
        api_key = request.POST.get('openai_api_key', '').strip()
        if not api_key:
            return JsonResponse({'success': False, 'error': 'API key is required'})
        if not api_key.startswith('sk-'):
            return JsonResponse({'success': False, 'error': 'Invalid API key format'})
        
        api_settings.set_openai_api_key(api_key)
        api_settings.save()
        return JsonResponse({
            'success': True,
            'message': 'API key saved!',
            'masked_key': api_settings.masked_api_key
        })
    
    elif action == 'delete_key':
        api_settings.set_openai_api_key(None)
        api_settings.save()
        return JsonResponse({'success': True, 'message': 'API key deleted'})
    
    elif action == 'test_key':
        api_key = api_settings.get_openai_api_key()
        if not api_key:
            return JsonResponse({'success': False, 'error': 'No API key set'})
        
        service = CaptionGeneratorService(api_key=api_key)
        result = service.generate_from_text(topic="Hello", tone="friendly", length="short")
        
        if result['success']:
            return JsonResponse({'success': True, 'message': 'API key is valid!'})
        else:
            return JsonResponse({'success': False, 'error': result.get('error', 'Test failed')})
    
    return JsonResponse({'success': False, 'error': 'Invalid action'})


@login_required
def caption_generator(request):
    """Main caption generator page"""
    
    # Check if user has API key - uses centralized lookup
    api_settings = get_or_create_api_settings(request.user)
    has_api_key = bool(get_user_api_key(request.user))

    if request.method == 'POST':
        if not has_api_key:
            messages.error(request, 'Please set your OpenAI API key first.')
            return redirect('ai_caption:api_settings')
        
        form = CaptionGenerationForm(request.POST, request.FILES)
        
        if form.is_valid():
            # Create caption generation record
            caption_gen = form.save(commit=False)
            caption_gen.user = request.user
            caption_gen.status = 'processing'
            
            # Determine media type
            if caption_gen.media_file:
                if caption_gen.is_image():
                    caption_gen.media_type = 'image'
                elif caption_gen.is_video():
                    caption_gen.media_type = 'video'
            else:
                caption_gen.media_type = 'none'
            
            caption_gen.save()
            
            # Generate caption using user's API key
            user_api_key = get_user_api_key(request.user)
            service = CaptionGeneratorService(api_key=user_api_key)
            
            try:
                if caption_gen.media_type == 'image':
                    result = service.generate_from_image(
                        image_path=caption_gen.media_file.path,
                        additional_context=caption_gen.input_text,
                        tone=caption_gen.tone,
                        length=caption_gen.length,
                        platform=caption_gen.platform,
                        include_hashtags=caption_gen.include_hashtags,
                        include_emojis=caption_gen.include_emojis,
                        include_cta=caption_gen.include_cta,
                        custom_instructions=caption_gen.custom_instructions
                    )
                elif caption_gen.media_type == 'video':
                    result = service.generate_from_video(
                        video_path=caption_gen.media_file.path,
                        additional_context=caption_gen.input_text,
                        tone=caption_gen.tone,
                        length=caption_gen.length,
                        platform=caption_gen.platform,
                        include_hashtags=caption_gen.include_hashtags,
                        include_emojis=caption_gen.include_emojis,
                        include_cta=caption_gen.include_cta,
                        custom_instructions=caption_gen.custom_instructions
                    )
                else:
                    result = service.generate_from_text(
                        topic=caption_gen.input_text,
                        tone=caption_gen.tone,
                        length=caption_gen.length,
                        platform=caption_gen.platform,
                        include_hashtags=caption_gen.include_hashtags,
                        include_emojis=caption_gen.include_emojis,
                        include_cta=caption_gen.include_cta,
                        custom_instructions=caption_gen.custom_instructions
                    )
                
                if result['success']:
                    caption_gen.generated_caption = result['caption']
                    caption_gen.generated_hashtags = result.get('hashtags', '')
                    caption_gen.media_analysis = result.get('analysis', '')
                    caption_gen.tokens_used = result.get('tokens_used', 0)
                    caption_gen.processing_time = result.get('processing_time', 0)
                    caption_gen.model_used = result.get('model_used', 'gpt-4o')
                    caption_gen.status = 'completed'
                    
                    # Update user's usage stats
                    api_settings.total_tokens_used += result.get('tokens_used', 0)
                    api_settings.total_generations += 1
                    api_settings.save()
                else:
                    caption_gen.status = 'failed'
                    caption_gen.error_message = result.get('error', 'Unknown error')
                
                caption_gen.save()
                
                if caption_gen.status == 'completed':
                    return redirect('ai_caption:result', pk=caption_gen.pk)
                else:
                    messages.error(request, f"Error generating caption: {caption_gen.error_message}")
                    
            except Exception as e:
                caption_gen.status = 'failed'
                caption_gen.error_message = str(e)
                caption_gen.save()
                messages.error(request, f"Error: {str(e)}")
    else:
        form = CaptionGenerationForm()
    
    # Get recent generations for sidebar
    recent_generations = CaptionGeneration.objects.filter(
        user=request.user,
        status='completed'
    ).order_by('-created_at')[:10]
    
    # Get global templates
    templates = CaptionTemplate.objects.filter(is_global=True)[:5]
    
    context = {
        'form': form,
        'recent_generations': recent_generations,
        'templates': templates,
        'has_api_key': has_api_key,
        'api_settings': api_settings,
    }
    
    return render(request, 'ai_caption/generator.html', context)


@login_required
def caption_result(request, pk):
    """View generated caption result"""
    
    caption_gen = get_object_or_404(CaptionGeneration, pk=pk, user=request.user)
    
    # Form for regenerating
    regenerate_form = RegenerateCaptionForm(initial={
        'original_caption': caption_gen.generated_caption,
        'tone': caption_gen.tone
    })
    
    # Form for saving
    save_form = SaveCaptionForm(initial={
        'caption_text': caption_gen.generated_caption,
        'hashtags': caption_gen.generated_hashtags
    })
    
    context = {
        'caption': caption_gen,
        'regenerate_form': regenerate_form,
        'save_form': save_form,
    }
    
    return render(request, 'ai_caption/result.html', context)


@login_required
@require_POST
def generate_ajax(request):
    """AJAX endpoint for caption generation"""
    
    try:
        # Check if user has API key - centralized lookup
        api_settings = get_or_create_api_settings(request.user)
        if not get_user_api_key(request.user):
            return JsonResponse({
                'success': False,
                'error': 'Please set your OpenAI API key in settings first.',
                'redirect': '/ai-caption/settings/'
            })
        
        input_text = request.POST.get('input_text', '')
        media_file = request.FILES.get('media_file')
        tone = request.POST.get('tone', 'professional')
        length = request.POST.get('length', 'medium')
        platform = request.POST.get('platform', 'general')
        include_hashtags = request.POST.get('include_hashtags', 'true') == 'true'
        include_emojis = request.POST.get('include_emojis', 'true') == 'true'
        include_cta = request.POST.get('include_cta', 'true') == 'true'
        custom_instructions = request.POST.get('custom_instructions', '')
        
        if not input_text and not media_file:
            return JsonResponse({
                'success': False,
                'error': 'Please provide text or upload a media file.'
            })
        
        # Create record
        caption_gen = CaptionGeneration.objects.create(
            user=request.user,
            input_text=input_text,
            tone=tone,
            length=length,
            platform=platform,
            include_hashtags=include_hashtags,
            include_emojis=include_emojis,
            include_cta=include_cta,
            custom_instructions=custom_instructions,
            status='processing'
        )
        
        # Handle media file
        if media_file:
            caption_gen.media_file = media_file
            caption_gen.save()
            
            if caption_gen.is_image():
                caption_gen.media_type = 'image'
            elif caption_gen.is_video():
                caption_gen.media_type = 'video'
            caption_gen.save()
        
        # Generate using user's API key
        user_api_key = get_user_api_key(request.user)
        service = CaptionGeneratorService(api_key=user_api_key)
        
        if caption_gen.media_type == 'image':
            result = service.generate_from_image(
                image_path=caption_gen.media_file.path,
                additional_context=input_text,
                tone=tone,
                length=length,
                platform=platform,
                include_hashtags=include_hashtags,
                include_emojis=include_emojis,
                include_cta=include_cta,
                custom_instructions=custom_instructions
            )
        elif caption_gen.media_type == 'video':
            result = service.generate_from_video(
                video_path=caption_gen.media_file.path,
                additional_context=input_text,
                tone=tone,
                length=length,
                platform=platform,
                include_hashtags=include_hashtags,
                include_emojis=include_emojis,
                include_cta=include_cta,
                custom_instructions=custom_instructions
            )
        else:
            result = service.generate_from_text(
                topic=input_text,
                tone=tone,
                length=length,
                platform=platform,
                include_hashtags=include_hashtags,
                include_emojis=include_emojis,
                include_cta=include_cta,
                custom_instructions=custom_instructions
            )
        
        if result['success']:
            caption_gen.generated_caption = result['caption']
            caption_gen.generated_hashtags = result.get('hashtags', '')
            caption_gen.media_analysis = result.get('analysis', '')
            caption_gen.tokens_used = result.get('tokens_used', 0)
            caption_gen.processing_time = result.get('processing_time', 0)
            caption_gen.model_used = result.get('model_used', 'gpt-4o')
            caption_gen.status = 'completed'
            caption_gen.save()
            
            # Update user's usage stats
            api_settings.total_tokens_used += result.get('tokens_used', 0)
            api_settings.total_generations += 1
            api_settings.save()
            
            return JsonResponse({
                'success': True,
                'caption_id': caption_gen.pk,
                'caption': result['caption'],
                'hashtags': result.get('hashtags', ''),
                'analysis': result.get('analysis', ''),
                'processing_time': round(result.get('processing_time', 0), 2),
                'tokens_used': result.get('tokens_used', 0)
            })
        else:
            caption_gen.status = 'failed'
            caption_gen.error_message = result.get('error', 'Unknown error')
            caption_gen.save()
            
            return JsonResponse({
                'success': False,
                'error': result.get('error', 'Unknown error')
            })
            
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        })


@login_required
@require_POST
def regenerate_caption(request, pk):
    """Regenerate caption with feedback"""
    
    caption_gen = get_object_or_404(CaptionGeneration, pk=pk, user=request.user)
    
    feedback = request.POST.get('feedback', '')
    tone = request.POST.get('tone', caption_gen.tone)
    
    if not feedback:
        return JsonResponse({
            'success': False,
            'error': 'Please provide feedback for regeneration.'
        })
    
    service = CaptionGeneratorService()
    
    result = service.regenerate_with_feedback(
        original_caption=caption_gen.generated_caption,
        feedback=feedback,
        tone=tone,
        platform=caption_gen.platform,
        include_hashtags=caption_gen.include_hashtags,
        include_emojis=caption_gen.include_emojis,
        include_cta=caption_gen.include_cta
    )
    
    if result['success']:
        # Update the record
        caption_gen.generated_caption = result['caption']
        caption_gen.generated_hashtags = result.get('hashtags', '')
        caption_gen.tokens_used += result.get('tokens_used', 0)
        caption_gen.save()
        
        return JsonResponse({
            'success': True,
            'caption': result['caption'],
            'hashtags': result.get('hashtags', '')
        })
    else:
        return JsonResponse({
            'success': False,
            'error': result.get('error', 'Unknown error')
        })


@login_required
@require_POST
def generate_variations(request):
    """Generate multiple caption variations"""
    
    topic = request.POST.get('topic', '')
    num_variations = int(request.POST.get('num_variations', 3))
    tone = request.POST.get('tone', 'professional')
    platform = request.POST.get('platform', 'general')
    
    if not topic:
        return JsonResponse({
            'success': False,
            'error': 'Please provide a topic.'
        })
    
    service = CaptionGeneratorService()
    
    result = service.generate_multiple_variations(
        topic_or_analysis=topic,
        num_variations=num_variations,
        tone=tone,
        platform=platform
    )
    
    if result['success']:
        return JsonResponse({
            'success': True,
            'captions': result['captions'],
            'processing_time': round(result.get('processing_time', 0), 2)
        })
    else:
        return JsonResponse({
            'success': False,
            'error': result.get('error', 'Unknown error')
        })


@login_required
@require_POST
def save_caption(request):
    """Save a generated caption"""
    
    caption_text = request.POST.get('caption_text', '')
    hashtags = request.POST.get('hashtags', '')
    notes = request.POST.get('notes', '')
    caption_id = request.POST.get('caption_id')
    is_favorite = request.POST.get('is_favorite', 'false') == 'true'
    
    if not caption_text:
        return JsonResponse({
            'success': False,
            'error': 'Caption text is required.'
        })
    
    saved = SavedCaption.objects.create(
        user=request.user,
        caption_generation_id=caption_id if caption_id else None,
        caption_text=caption_text,
        hashtags=hashtags,
        notes=notes,
        is_favorite=is_favorite
    )
    
    return JsonResponse({
        'success': True,
        'saved_id': saved.pk,
        'message': 'Caption saved successfully!'
    })


@login_required
def caption_history(request):
    """View caption generation history"""
    
    generations = CaptionGeneration.objects.filter(
        user=request.user
    ).order_by('-created_at')
    
    # Filtering
    status = request.GET.get('status')
    platform = request.GET.get('platform')
    media_type = request.GET.get('media_type')
    
    if status:
        generations = generations.filter(status=status)
    if platform:
        generations = generations.filter(platform=platform)
    if media_type:
        generations = generations.filter(media_type=media_type)
    
    # Pagination
    paginator = Paginator(generations, 20)
    page = request.GET.get('page')
    generations = paginator.get_page(page)
    
    context = {
        'generations': generations,
        'status_filter': status,
        'platform_filter': platform,
        'media_type_filter': media_type,
    }
    
    return render(request, 'ai_caption/history.html', context)


@login_required
def saved_captions(request):
    """View saved captions"""
    
    saved = SavedCaption.objects.filter(user=request.user).order_by('-created_at')
    
    # Filter favorites
    favorites_only = request.GET.get('favorites') == 'true'
    if favorites_only:
        saved = saved.filter(is_favorite=True)
    
    # Pagination
    paginator = Paginator(saved, 20)
    page = request.GET.get('page')
    saved = paginator.get_page(page)
    
    context = {
        'saved_captions': saved,
        'favorites_only': favorites_only,
    }
    
    return render(request, 'ai_caption/saved.html', context)


@login_required
@require_POST
def delete_saved_caption(request, pk):
    """Delete a saved caption"""
    
    saved = get_object_or_404(SavedCaption, pk=pk, user=request.user)
    saved.delete()
    
    return JsonResponse({
        'success': True,
        'message': 'Caption deleted.'
    })


@login_required
@require_POST
def toggle_favorite(request, pk):
    """Toggle favorite status"""
    
    saved = get_object_or_404(SavedCaption, pk=pk, user=request.user)
    saved.is_favorite = not saved.is_favorite
    saved.save()
    
    return JsonResponse({
        'success': True,
        'is_favorite': saved.is_favorite
    })


@login_required
@require_POST
def copy_to_post(request, pk):
    """Copy saved caption to create a new post"""
    
    saved = get_object_or_404(SavedCaption, pk=pk, user=request.user)
    saved.used_count += 1
    saved.save()
    
    # Store in session for post creation
    request.session['prefill_caption'] = saved.caption_text
    if saved.hashtags:
        request.session['prefill_caption'] += '\n\n' + saved.hashtags
    
    return JsonResponse({
        'success': True,
        'redirect_url': '/posts/create/'  # Adjust URL as needed
    })


@login_required
def templates_list(request):
    """View and manage caption templates"""
    
    # User templates
    user_templates = CaptionTemplate.objects.filter(user=request.user).order_by('category', 'name')
    
    # Global templates
    global_templates = CaptionTemplate.objects.filter(is_global=True).order_by('category', 'name')
    
    context = {
        'user_templates': user_templates,
        'global_templates': global_templates,
    }
    
    return render(request, 'ai_caption/templates.html', context)


@login_required
def create_template(request):
    """Create a new caption template"""
    
    if request.method == 'POST':
        form = CaptionTemplateForm(request.POST)
        if form.is_valid():
            template = form.save(commit=False)
            template.user = request.user
            template.save()
            messages.success(request, 'Template created successfully!')
            return redirect('ai_caption:templates')
    else:
        form = CaptionTemplateForm()
    
    return render(request, 'ai_caption/template_form.html', {'form': form})


@login_required
@require_POST
def use_template(request, pk):
    """Use a template to generate caption"""
    
    # Check if user has API key - centralized lookup
    api_settings = get_or_create_api_settings(request.user)
    if not get_user_api_key(request.user):
        return JsonResponse({
            'success': False,
            'error': 'Please set your OpenAI API key first.',
            'redirect': '/ai-caption/settings/'
        })

    template = get_object_or_404(CaptionTemplate, pk=pk)
    
    # Check access
    if not template.is_global and template.user != request.user:
        return JsonResponse({
            'success': False,
            'error': 'Access denied.'
        })
    
    # Get variables from request
    variables = {}
    for key in ['topic', 'brand', 'product', 'name', 'date', 'offer']:
        if request.POST.get(key):
            variables[key] = request.POST.get(key)
    
    # Fill template
    filled_text = template.template_text
    for key, value in variables.items():
        filled_text = filled_text.replace(f'{{{key}}}', value)
    
    # Generate using filled template with user's API key
    user_api_key = get_user_api_key(request.user)
    service = CaptionGeneratorService(api_key=user_api_key)
    
    result = service.generate_from_text(
        topic=filled_text,
        tone=template.tone,
        platform=template.platform
    )
    
    # Update usage stats if successful
    if result['success']:
        api_settings.total_tokens_used += result.get('tokens_used', 0)
        api_settings.total_generations += 1
        api_settings.save()
    
    return JsonResponse({
        'success': result['success'],
        'caption': result.get('caption', ''),
        'hashtags': result.get('hashtags', ''),
        'error': result.get('error', '')
    })


@login_required
@require_POST
def delete_generation(request, pk):
    """Delete a caption generation record"""
    
    caption_gen = get_object_or_404(CaptionGeneration, pk=pk, user=request.user)
    
    # Delete associated media file
    if caption_gen.media_file:
        if os.path.exists(caption_gen.media_file.path):
            os.remove(caption_gen.media_file.path)
    
    caption_gen.delete()
    
    return JsonResponse({
        'success': True,
        'message': 'Deleted successfully.'
    })


@login_required
@require_GET
def get_caption_data(request, pk):
    """Get caption data as JSON"""
    
    caption_gen = get_object_or_404(CaptionGeneration, pk=pk, user=request.user)
    
    return JsonResponse({
        'success': True,
        'data': {
            'id': caption_gen.pk,
            'input_text': caption_gen.input_text,
            'caption': caption_gen.generated_caption,
            'hashtags': caption_gen.generated_hashtags,
            'analysis': caption_gen.media_analysis,
            'tone': caption_gen.tone,
            'platform': caption_gen.platform,
            'media_type': caption_gen.media_type,
            'media_url': caption_gen.media_file.url if caption_gen.media_file else None,
            'status': caption_gen.status,
            'created_at': caption_gen.created_at.isoformat(),
        }
    })


@login_required
@require_POST
def delete_template(request, pk):
    """Delete a caption template"""
    
    template = get_object_or_404(CaptionTemplate, pk=pk, user=request.user)
    
    # Only allow deletion of user's own templates
    if template.is_global and not request.user.is_staff:
        return JsonResponse({
            'success': False,
            'error': 'Cannot delete global templates.'
        })
    
    template.delete()
    
    return JsonResponse({
        'success': True,
        'message': 'Template deleted successfully.'
    })


@login_required
@require_POST
def use_caption(request):
    """Store caption in session and redirect to create post"""
    
    caption = request.POST.get('caption', '')
    
    if caption:
        # Store in session for create_post to use
        request.session['prefilled_caption'] = caption
        messages.success(request, '✅ Caption ready! Complete your post below.')
    
    return redirect('create_post')