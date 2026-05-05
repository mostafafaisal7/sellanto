# video_studio/views.py

"""
API Views for Video Studio
"""

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse, FileResponse, Http404
from django.views.decorators.http import require_POST, require_GET
from django.shortcuts import get_object_or_404
from django.core.paginator import Paginator
from django.db import transaction

from .models import VideoProject, VideoClip, MergedVideo, VideoTemplate, PromptOptimizationLog
from .services.veo_service import VeoVideoService
from .services.prompt_builder import BrandDNAPromptBuilder, get_template_prompt
from .services.optimizer import GeminiPromptOptimizer
from .tasks import generate_video_clip_task, batch_generate_clips_task, merge_clips_task, optimize_prompts_task
from brands.models import Brand, Workspace
from accounts.api_keys import get_gemini_key

import json


# ========== Project Management ==========

@login_required
@require_POST
def create_project(request):
    """Create a new video project"""
    try:
        data = json.loads(request.body)

        # Get workspace and brand
        workspace_id = data.get('workspace_id')
        brand_id = data.get('brand_id')

        workspace = None
        brand = None

        if workspace_id:
            workspace = get_object_or_404(Workspace, id=workspace_id, user=request.user)

        if brand_id:
            brand = get_object_or_404(Brand, id=brand_id)

        # Create project
        project = VideoProject.objects.create(
            user=request.user,
            workspace=workspace,
            brand=brand,
            name=data.get('name', 'Untitled Project'),
            description=data.get('description', ''),
            product_name=data.get('product_name', ''),
            product_description=data.get('product_description', ''),
            product_category=data.get('product_category', ''),
            product_images=data.get('product_images', []),
            target_platforms=data.get('target_platforms', []),
            default_aspect_ratio=data.get('default_aspect_ratio', '16:9'),
            default_resolution=data.get('default_resolution', '1080p'),
            auto_merge=data.get('auto_merge', False)
        )

        return JsonResponse({
            'success': True,
            'project_id': project.id,
            'message': 'Project created successfully'
        })

    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=400)


@login_required
@require_GET
def list_projects(request):
    """List user's video projects"""
    try:
        projects = VideoProject.objects.filter(user=request.user).order_by('-created_at')

        # Pagination
        page = request.GET.get('page', 1)
        paginator = Paginator(projects, 12)
        projects_page = paginator.get_page(page)

        projects_data = [{
            'id': p.id,
            'name': p.name,
            'description': p.description,
            'status': p.status,
            'progress': p.progress,
            'total_clips': p.total_clips,
            'completed_clips': p.completed_clips,
            'product_name': p.product_name,
            'brand_name': p.brand.brand_name if p.brand else None,
            'created_at': p.created_at.isoformat(),
        } for p in projects_page]

        return JsonResponse({
            'success': True,
            'projects': projects_data,
            'total_count': paginator.count,
            'page': page,
            'total_pages': paginator.num_pages
        })

    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=400)


@login_required
@require_GET
def get_project_detail(request, project_id):
    """Get project details with clips"""
    try:
        project = get_object_or_404(VideoProject, id=project_id, user=request.user)

        clips = project.clips.all().order_by('order_index')
        clips_data = [{
            'id': c.id,
            'prompt': c.prompt,
            'enhanced_prompt': c.enhanced_prompt,
            'status': c.status,
            'video_url': c.get_video_url(),
            'thumbnail_url': c.get_thumbnail_url(),
            'duration': c.duration,
            'aspect_ratio': c.aspect_ratio,
            'resolution': c.resolution,
            'is_selected': c.is_selected,
            'order_index': c.order_index,
            'generation_cost': float(c.generation_cost),
            'processing_time': c.processing_time,
            'error_message': c.error_message,
        } for c in clips]

        return JsonResponse({
            'success': True,
            'project': {
                'id': project.id,
                'name': project.name,
                'description': project.description,
                'status': project.status,
                'progress': project.progress,
                'total_clips': project.total_clips,
                'completed_clips': project.completed_clips,
                'product_name': project.product_name,
                'product_description': project.product_description,
                'brand': {
                    'id': project.brand.id,
                    'name': project.brand.brand_name
                } if project.brand else None,
                'clips': clips_data,
                'total_cost': float(project.calculate_total_cost()),
            }
        })

    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=400)


# ========== Clip Generation ==========

@login_required
@require_POST
def generate_single_clip(request):
    """Generate a single video clip"""
    try:
        data = json.loads(request.body)

        project_id = data.get('project_id')
        project = get_object_or_404(VideoProject, id=project_id, user=request.user)

        # Get API key
        api_key = get_gemini_key(request.user)
        if not api_key:
            return JsonResponse({
                'success': False,
                'error': 'Gemini API key not configured. Please set it in your account settings.'
            }, status=400)

        # Build enhanced prompt
        prompt_builder = BrandDNAPromptBuilder()
        enhanced_prompt = prompt_builder.build_enhanced_prompt(
            user_prompt=data.get('prompt'),
            brand=project.brand,
            product_image=None,  # TODO: Handle image upload
            workspace=project.workspace,
            user=request.user,
        )

        # Optionally optimize with Gemini
        optimized_prompt = enhanced_prompt
        if data.get('optimize_prompt', False):
            optimizer = GeminiPromptOptimizer(api_key=api_key)
            optimized_prompt = optimizer.optimize_prompt_for_veo(
                user_prompt=enhanced_prompt,
                brand=project.brand,
                product_category=project.product_category
            )

        # Create clip
        clip = VideoClip.objects.create(
            project=project,
            prompt=data.get('prompt'),
            enhanced_prompt=enhanced_prompt,
            optimized_prompt=optimized_prompt,
            duration=data.get('duration', 8),
            aspect_ratio=data.get('aspect_ratio', project.default_aspect_ratio),
            resolution=data.get('resolution', project.default_resolution),
            camera_movement=data.get('camera_movement', ''),
            lighting_style=data.get('lighting_style', ''),
            veo_seed=data.get('seed', None),
            order_index=project.clips.count(),
            status='pending'
        )

        # Update project
        project.total_clips += 1
        project.status = 'generating'
        project.save()

        # Queue generation task
        task = generate_video_clip_task.delay(clip.id)

        return JsonResponse({
            'success': True,
            'clip_id': clip.id,
            'task_id': task.id,
            'message': 'Video generation started'
        })

    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=400)


@login_required
@require_POST
def batch_generate_clips(request):
    """Generate multiple clips from template or prompts list"""
    try:
        data = json.loads(request.body)

        project_id = data.get('project_id')
        project = get_object_or_404(VideoProject, id=project_id, user=request.user)

        # Check API key
        api_key = get_gemini_key(request.user)
        if not api_key:
            return JsonResponse({
                'success': False,
                'error': 'Gemini API key not configured'
            }, status=400)

        prompts_list = []

        # Option 1: Use template
        template_id = data.get('template_id')
        if template_id:
            template = get_object_or_404(VideoTemplate, id=template_id)

            for clip_config in template.clips_config:
                # Fill in product name
                prompt_text = clip_config['prompt'].replace('{product}', project.product_name)

                prompts_list.append({
                    'prompt': prompt_text,
                    'enhanced_prompt': prompt_text,  # Will be enhanced in task
                    'duration': clip_config.get('duration', 8),
                    'camera_movement': clip_config.get('camera_movement', ''),
                    'lighting_style': clip_config.get('lighting', '')
                })

        # Option 2: Use custom prompts
        elif 'prompts' in data:
            for prompt_data in data['prompts']:
                prompts_list.append({
                    'prompt': prompt_data.get('prompt'),
                    'enhanced_prompt': prompt_data.get('enhanced_prompt', prompt_data.get('prompt')),
                    'duration': prompt_data.get('duration', 8),
                    'aspect_ratio': prompt_data.get('aspect_ratio', project.default_aspect_ratio),
                    'resolution': prompt_data.get('resolution', project.default_resolution)
                })

        if not prompts_list:
            return JsonResponse({
                'success': False,
                'error': 'No prompts provided'
            }, status=400)

        # Queue batch generation
        task = batch_generate_clips_task.delay(project.id, prompts_list)

        return JsonResponse({
            'success': True,
            'clips_count': len(prompts_list),
            'task_id': task.id,
            'message': f'Generating {len(prompts_list)} clips'
        })

    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=400)


@login_required
@require_GET
def get_clip_status(request, clip_id):
    """Get clip generation status"""
    try:
        clip = get_object_or_404(VideoClip, id=clip_id, project__user=request.user)

        return JsonResponse({
            'success': True,
            'clip': {
                'id': clip.id,
                'status': clip.status,
                'video_url': clip.get_video_url(),
                'thumbnail_url': clip.get_thumbnail_url(),
                'processing_time': clip.processing_time,
                'error_message': clip.error_message,
            }
        })

    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=400)


# ========== Clip Management ==========

@login_required
@require_POST
def update_clip_selection(request):
    """Select/deselect clips for merging"""
    try:
        data = json.loads(request.body)

        clip_ids = data.get('clip_ids', [])
        selected = data.get('selected', True)

        clips = VideoClip.objects.filter(
            id__in=clip_ids,
            project__user=request.user
        )

        clips.update(is_selected=selected)

        return JsonResponse({
            'success': True,
            'updated_count': clips.count()
        })

    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=400)


@login_required
@require_POST
def reorder_clips(request):
    """Reorder clips"""
    try:
        data = json.loads(request.body)

        clip_order = data.get('clip_order', [])  # List of clip IDs in new order

        with transaction.atomic():
            for index, clip_id in enumerate(clip_order):
                VideoClip.objects.filter(
                    id=clip_id,
                    project__user=request.user
                ).update(order_index=index)

        return JsonResponse({
            'success': True,
            'message': 'Clips reordered successfully'
        })

    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=400)


# ========== Video Merging ==========

@login_required
@require_POST
def merge_selected_clips(request):
    """Merge selected clips into final video"""
    try:
        data = json.loads(request.body)

        project_id = data.get('project_id')
        project = get_object_or_404(VideoProject, id=project_id, user=request.user)

        # Get selected clips
        selected_clips = project.get_selected_clips()

        if not selected_clips.exists():
            return JsonResponse({
                'success': False,
                'error': 'No clips selected for merging'
            }, status=400)

        clip_ids = list(selected_clips.values_list('id', flat=True))

        # Create merged video record
        merged_video = MergedVideo.objects.create(
            project=project,
            clip_ids=clip_ids,
            transition_type=data.get('transition_type', 'crossfade'),
            transition_duration=data.get('transition_duration', 0.5),
            resolution=project.default_resolution,
            aspect_ratio=project.default_aspect_ratio,
            has_captions=data.get('add_captions', False),
            captions_data=data.get('captions_data', []),
            music_volume=data.get('music_volume', 0.3),
            status='pending'
        )

        # Update project status
        project.status = 'merging'
        project.save()

        # Queue merge task
        task = merge_clips_task.delay(merged_video.id)

        return JsonResponse({
            'success': True,
            'merged_video_id': merged_video.id,
            'task_id': task.id,
            'message': 'Video merging started'
        })

    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=400)


@login_required
@require_GET
def get_merged_video_status(request, merged_video_id):
    """Get merged video status"""
    try:
        merged_video = get_object_or_404(MergedVideo, id=merged_video_id, project__user=request.user)

        return JsonResponse({
            'success': True,
            'merged_video': {
                'id': merged_video.id,
                'status': merged_video.status,
                'video_url': merged_video.get_video_url(),
                'total_duration': merged_video.total_duration,
                'processing_time': merged_video.processing_time,
                'error_message': merged_video.error_message,
            }
        })

    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=400)


# ========== Download ==========

@login_required
def download_clip(request, clip_id):
    """Download individual clip"""
    try:
        clip = get_object_or_404(VideoClip, id=clip_id, project__user=request.user)

        if not clip.video_file:
            raise Http404("Video file not found")

        response = FileResponse(open(clip.video_file.path, 'rb'), content_type='video/mp4')
        filename = f"{clip.project.product_name}_{clip.id}.mp4".replace(' ', '_')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'

        return response

    except Exception as e:
        raise Http404(str(e))


@login_required
def download_merged_video(request, merged_video_id):
    """Download merged video"""
    try:
        merged_video = get_object_or_404(MergedVideo, id=merged_video_id, project__user=request.user)

        if not merged_video.merged_video:
            raise Http404("Video file not found")

        response = FileResponse(open(merged_video.merged_video.path, 'rb'), content_type='video/mp4')
        filename = f"{merged_video.project.name}_{merged_video.id}.mp4".replace(' ', '_')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'

        return response

    except Exception as e:
        raise Http404(str(e))


# ========== Templates ==========

@login_required
@require_GET
def list_templates(request):
    """List available video templates"""
    try:
        templates = VideoTemplate.objects.filter(
            is_active=True
        ).filter(
            is_global=True
        ) | VideoTemplate.objects.filter(
            created_by=request.user,
            is_active=True
        )

        templates = templates.distinct().order_by('-times_used', 'name')

        templates_data = [{
            'id': t.id,
            'name': t.name,
            'description': t.description,
            'category': t.category,
            'recommended_duration': t.recommended_duration,
            'clips_count': len(t.clips_config),
            'times_used': t.times_used,
            'avg_rating': t.avg_rating,
            'preview_thumbnail_url': t.preview_thumbnail.url if t.preview_thumbnail else None
        } for t in templates]

        return JsonResponse({
            'success': True,
            'templates': templates_data
        })

    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=400)


# ========== Utilities ==========

@login_required
@require_POST
def test_api_key(request):
    """Test Gemini API key"""
    try:
        api_key = get_gemini_key(request.user)

        if not api_key:
            return JsonResponse({
                'success': False,
                'error': 'No API key configured'
            })

        veo_service = VeoVideoService(api_key=api_key)
        result = veo_service.test_api_key()

        return JsonResponse(result)

    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=400)
