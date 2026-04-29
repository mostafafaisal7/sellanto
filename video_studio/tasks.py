# video_studio/tasks.py

"""
Celery Tasks for Video Studio
Async video generation and processing
"""

from celery import shared_task
from django.core.files.base import ContentFile
from django.contrib.auth.models import User
import time
import uuid

from .models import VideoProject, VideoClip, MergedVideo, PromptOptimizationLog
from .services.veo_service import VeoVideoService
from .services.prompt_builder import BrandDNAPromptBuilder
from .services.merge_service import VideoMergeService
from .services.image_processor import ProductImageProcessor
from .services.optimizer import GeminiPromptOptimizer
from accounts.api_keys import get_gemini_key


@shared_task(bind=True)
def generate_video_clip_task(self, clip_id):
    """
    Async task to generate a single video clip using Veo API

    Args:
        clip_id (int): VideoClip model ID

    Returns:
        dict: Result status
    """
    try:
        clip = VideoClip.objects.get(id=clip_id)
        clip.status = 'processing'
        clip.save()

        # Get API key
        api_key = get_gemini_key(clip.project.user)
        if not api_key:
            clip.status = 'failed'
            clip.error_message = 'Gemini API key not configured'
            clip.save()
            return {'success': False, 'error': 'API key not configured'}

        # Initialize services
        veo_service = VeoVideoService(api_key=api_key)
        image_processor = ProductImageProcessor()

        # Prepare start frame if provided
        reference_image = None
        if clip.start_frame:
            reference_image = image_processor.preprocess_for_veo(
                clip.start_frame.path,
                remove_background=False
            )

        # Generate video
        result = veo_service.generate_video(
            prompt=clip.optimized_prompt or clip.enhanced_prompt or clip.prompt,
            reference_image=reference_image,
            duration=clip.duration,
            aspect_ratio=clip.aspect_ratio,
            resolution=clip.resolution,
            model_tier='standard',  # Default to standard
            seed=clip.veo_seed,
            camera_movement=clip.camera_movement,
            lighting_style=clip.lighting_style
        )

        if result['success']:
            # Save video file
            video_filename = f"{uuid.uuid4().hex}.mp4"
            clip.video_file.save(video_filename, ContentFile(result['video_data']), save=False)

            # Generate thumbnail
            thumbnail_data = image_processor.extract_first_frame_from_video(clip.video_file.path)
            if thumbnail_data:
                thumb_filename = f"{uuid.uuid4().hex}.jpg"
                clip.thumbnail.save(thumb_filename, ContentFile(thumbnail_data), save=False)

            # Update clip status
            clip.status = 'completed'
            clip.veo_model_used = result.get('model_used', '')
            clip.processing_time = result.get('processing_time', 0)
            clip.generation_cost = result.get('cost', 0)
            clip.file_size = len(result['video_data'])
            clip.save()

            # Update project progress
            clip.project.completed_clips += 1
            clip.project.update_progress()

            if clip.project.completed_clips >= clip.project.total_clips:
                clip.project.status = 'ready'
                clip.project.save()

            return {'success': True, 'clip_id': clip_id}

        else:
            # Failed
            clip.status = 'failed'
            clip.error_message = result.get('error', 'Unknown error')
            clip.save()

            return {'success': False, 'error': result.get('error')}

    except VideoClip.DoesNotExist:
        return {'success': False, 'error': f'Clip {clip_id} not found'}
    except Exception as e:
        try:
            clip = VideoClip.objects.get(id=clip_id)
            clip.status = 'failed'
            clip.error_message = str(e)
            clip.save()
        except:
            pass

        return {'success': False, 'error': str(e)}


@shared_task(bind=True)
def batch_generate_clips_task(self, project_id, prompts_list):
    """
    Generate multiple clips for a project

    Args:
        project_id (int): VideoProject ID
        prompts_list (list): List of prompt dicts

    Returns:
        dict: Result status
    """
    try:
        project = VideoProject.objects.get(id=project_id)
        project.status = 'generating'
        project.total_clips = len(prompts_list)
        project.completed_clips = 0
        project.save()

        # Create clips and queue generation tasks
        for i, prompt_data in enumerate(prompts_list):
            clip = VideoClip.objects.create(
                project=project,
                prompt=prompt_data['prompt'],
                enhanced_prompt=prompt_data.get('enhanced_prompt', prompt_data['prompt']),
                optimized_prompt=prompt_data.get('optimized_prompt', ''),
                duration=prompt_data.get('duration', 8),
                aspect_ratio=prompt_data.get('aspect_ratio', project.default_aspect_ratio),
                resolution=prompt_data.get('resolution', project.default_resolution),
                order_index=i,
                status='pending'
            )

            # Queue generation task
            generate_video_clip_task.delay(clip.id)

        return {'success': True, 'clips_created': len(prompts_list)}

    except VideoProject.DoesNotExist:
        return {'success': False, 'error': f'Project {project_id} not found'}
    except Exception as e:
        return {'success': False, 'error': str(e)}


@shared_task(bind=True)
def merge_clips_task(self, merged_video_id):
    """
    Merge selected clips into final video

    Args:
        merged_video_id (int): MergedVideo model ID

    Returns:
        dict: Result status
    """
    try:
        merged_video = MergedVideo.objects.get(id=merged_video_id)
        merged_video.status = 'processing'
        merged_video.save()

        start_time = time.time()

        # Get clips
        clips = merged_video.get_clips()

        if not clips:
            merged_video.status = 'failed'
            merged_video.error_message = 'No clips to merge'
            merged_video.save()
            return {'success': False, 'error': 'No clips to merge'}

        # Get clip paths
        clip_paths = [clip.video_file.path for clip in clips if clip.video_file]

        if not clip_paths:
            merged_video.status = 'failed'
            merged_video.error_message = 'No valid video files found'
            merged_video.save()
            return {'success': False, 'error': 'No valid video files'}

        # Initialize merge service
        merge_service = VideoMergeService()

        # Merge videos
        output_path = merge_service.merge_clips(
            clip_paths=clip_paths,
            transition_type=merged_video.transition_type,
            transition_duration=merged_video.transition_duration,
            add_captions=merged_video.has_captions,
            captions_data=merged_video.captions_data if merged_video.has_captions else None,
            background_music=merged_video.background_music.path if merged_video.background_music else None,
            music_volume=merged_video.music_volume
        )

        if output_path:
            # Save merged video
            with open(output_path, 'rb') as f:
                filename = f"{uuid.uuid4().hex}.mp4"
                merged_video.merged_video.save(filename, ContentFile(f.read()), save=False)

            # Get video info
            video_info = merge_service.get_video_info(merged_video.merged_video.path)
            if video_info:
                merged_video.total_duration = video_info['duration']
                merged_video.file_size = merged_video.merged_video.size

            # Generate thumbnail
            thumbnail_data = merge_service.extract_thumbnail(merged_video.merged_video.path)
            if thumbnail_data:
                thumb_filename = f"{uuid.uuid4().hex}.jpg"
                merged_video.thumbnail.save(thumb_filename, ContentFile(thumbnail_data), save=False)

            merged_video.status = 'completed'
            merged_video.processing_time = time.time() - start_time
            merged_video.save()

            # Update project status
            merged_video.project.status = 'completed'
            merged_video.project.save()

            return {'success': True, 'merged_video_id': merged_video_id}

        else:
            merged_video.status = 'failed'
            merged_video.error_message = 'Merge failed'
            merged_video.save()
            return {'success': False, 'error': 'Merge failed'}

    except MergedVideo.DoesNotExist:
        return {'success': False, 'error': f'MergedVideo {merged_video_id} not found'}
    except Exception as e:
        try:
            merged_video = MergedVideo.objects.get(id=merged_video_id)
            merged_video.status = 'failed'
            merged_video.error_message = str(e)
            merged_video.save()
        except:
            pass

        return {'success': False, 'error': str(e)}


@shared_task(bind=True)
def optimize_prompts_task(self, project_id):
    """
    Optimize all prompts in a project using Gemini

    Args:
        project_id (int): VideoProject ID

    Returns:
        dict: Optimized prompts
    """
    try:
        project = VideoProject.objects.get(id=project_id)

        # Get API key
        api_key = get_gemini_key(project.user)
        if not api_key:
            return {'success': False, 'error': 'API key not configured'}

        # Initialize optimizer
        optimizer = GeminiPromptOptimizer(api_key=api_key)

        # Get all clips
        clips = project.clips.all()

        optimized_prompts = []

        for clip in clips:
            if not clip.optimized_prompt:
                # Optimize prompt
                optimized = optimizer.optimize_prompt_for_veo(
                    user_prompt=clip.enhanced_prompt or clip.prompt,
                    brand=project.brand,
                    product_category=project.product_category
                )

                clip.optimized_prompt = optimized
                clip.save()

                # Log optimization
                PromptOptimizationLog.objects.create(
                    project=project,
                    brand=project.brand,
                    original_prompt=clip.prompt,
                    optimized_prompt=optimized,
                    optimization_model='gemini-2.5-pro',
                    enhancement_type='gemini'
                )

                optimized_prompts.append({
                    'clip_id': clip.id,
                    'original': clip.prompt,
                    'optimized': optimized
                })

        return {'success': True, 'optimized_count': len(optimized_prompts)}

    except VideoProject.DoesNotExist:
        return {'success': False, 'error': f'Project {project_id} not found'}
    except Exception as e:
        return {'success': False, 'error': str(e)}
