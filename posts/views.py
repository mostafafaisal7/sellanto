# C:\Users\Trust computer\Desktop\Final_version_socialSync\posts\views.py

from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.utils import timezone
from django.http import JsonResponse
from datetime import datetime
import os
import time
import json
import pytz
from django.conf import settings

from .models import Post
from platforms.models import SocialAccount
from accounts.models import UserProfile


@login_required
def create_post(request):
    """Create new post with multiple media support"""
    
    # Get user's connected accounts
    connected_accounts = SocialAccount.objects.filter(
        user=request.user, 
        is_active=True
    )
    
    # Group by platform
    platforms = {}
    for account in connected_accounts:
        if account.platform not in platforms:
            platforms[account.platform] = []
        platforms[account.platform].append(account)
    
    # Get pre-filled caption from session (from AI Caption)
    prefilled_caption = request.session.pop('prefilled_caption', '')
    
    if request.method == 'POST':
        try:
            caption = request.POST.get('caption', '').strip()
            scheduled_time = request.POST.get('scheduled_time', '').strip()
            selected_platforms = request.POST.getlist('platforms')
            ai_generated = request.POST.get('ai_generated') == 'true'
            
            # Validation
            if not caption:
                messages.error(request, '❌ Caption is required')
                return redirect('create_post')
            
            if not selected_platforms:
                messages.error(request, '❌ Please select at least one platform')
                return redirect('create_post')
            
            if not scheduled_time:
                messages.error(request, '❌ Scheduled time is required')
                return redirect('create_post')
            
            # Parse scheduled time
            try:
                # Handle both formats
                if 'T' in scheduled_time:
                    scheduled_dt = datetime.strptime(scheduled_time, '%Y-%m-%dT%H:%M')
                else:
                    scheduled_dt = datetime.strptime(scheduled_time, '%Y-%m-%d %H:%M')
                
                # User's timezone (Bangladesh)
                bd_tz = pytz.timezone('Asia/Dhaka')
                
                # Make aware in Bangladesh timezone
                scheduled_dt = bd_tz.localize(scheduled_dt)
                
                # Convert to UTC (this is what gets saved to database)
                scheduled_dt = scheduled_dt.astimezone(pytz.UTC)
                    
            except ValueError as e:
                messages.error(request, f'❌ Invalid date/time format: {str(e)}')
                return redirect('create_post')
            
            # Check monthly limit
            profile = request.user.profile
            if profile.posts_this_month >= profile.max_posts_per_month:
                messages.error(request, f'❌ Monthly limit reached ({profile.max_posts_per_month} posts)')
                return redirect('create_post')
            
            # Create post first
            post = Post.objects.create(
                user=request.user,
                caption=caption,
                scheduled_time=scheduled_dt,
                ai_generated=ai_generated,
                status='scheduled'
            )
            
            # Set platforms
            post.set_platforms(selected_platforms)
            
            # Handle multiple media files
            media_files_list = request.FILES.getlist('media')
            saved_paths = []
            
            if len(media_files_list) > 0:
                for idx, uploaded_file in enumerate(media_files_list):
                    # Validate size (50MB max per file)
                    max_size = 50 * 1024 * 1024
                    if uploaded_file.size > max_size:
                        continue
                    
                    # Get extension
                    ext = os.path.splitext(uploaded_file.name)[1].lower()
                    
                    # Validate file type
                    allowed_types = ['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.mov', '.avi']
                    if ext not in allowed_types:
                        continue
                    
                    # Create unique filename
                    timestamp = time.time()
                    filename = f"{int(timestamp)}_{idx}{ext}"
                    
                    # Create user-specific directory
                    user_dir = os.path.join('posts', str(request.user.id))
                    full_dir = os.path.join(settings.MEDIA_ROOT, user_dir)
                    os.makedirs(full_dir, exist_ok=True)
                    
                    # Save file
                    file_path = os.path.join(user_dir, filename)
                    full_path = os.path.join(settings.MEDIA_ROOT, file_path)
                    
                    # Write file
                    with open(full_path, 'wb+') as destination:
                        for chunk in uploaded_file.chunks():
                            destination.write(chunk)
                    
                    saved_paths.append(file_path)
                
                # Save media paths to post
                if saved_paths:
                    post.set_media_files(saved_paths)
            
            post.save()
            
            # Update monthly counter
            profile.posts_this_month += 1
            profile.save()
            
            messages.success(request, f'✅ Post scheduled for {scheduled_dt.strftime("%B %d, %Y at %I:%M %p")}')
            return redirect('my_posts')
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            messages.error(request, f'❌ Failed to create post: {str(e)}')
            return redirect('create_post')
    
    # GET request
    context = {
        'connected_accounts': connected_accounts,
        'platforms': platforms,
        'has_accounts': connected_accounts.exists(),
        'prefilled_caption': prefilled_caption,  # Pre-filled caption from AI
        'MEDIA_URL': settings.MEDIA_URL,
    }
    
    return render(request, 'posts/create_post.html', context)


@login_required
def my_posts(request):
    """View user's posts"""
    
    # Get filter
    status_filter = request.GET.get('status', 'all')
    
    # Base query
    posts = Post.objects.filter(user=request.user)
    
    # Apply filter
    if status_filter != 'all':
        posts = posts.filter(status=status_filter)
    
    # Order by scheduled time
    posts = posts.order_by('-scheduled_time')
    
    # Stats
    total_posts = Post.objects.filter(user=request.user).count()
    scheduled_posts = Post.objects.filter(user=request.user, status='scheduled').count()
    posted_posts = Post.objects.filter(user=request.user, status='posted').count()
    failed_posts = Post.objects.filter(user=request.user, status='failed').count()
    
    context = {
        'posts': posts,
        'status_filter': status_filter,
        'total_posts': total_posts,
        'scheduled_posts': scheduled_posts,
        'posted_posts': posted_posts,
        'failed_posts': failed_posts,
        'MEDIA_URL': settings.MEDIA_URL,  # Add MEDIA_URL to context
    }
    
    return render(request, 'posts/my_posts.html', context)


@login_required
def edit_post(request, post_id):
    """Edit post"""
    
    post = get_object_or_404(Post, id=post_id, user=request.user)
    
    # Check if post can be edited
    if not post.can_be_edited():
        messages.error(request, '❌ This post cannot be edited')
        return redirect('my_posts')
    
    if request.method == 'POST':
        caption = request.POST.get('caption', '').strip()
        scheduled_time = request.POST.get('scheduled_time', '').strip()
        selected_platforms = request.POST.getlist('platforms')
        
        # Update post
        post.caption = caption
        post.set_platforms(selected_platforms)
        
        # Parse scheduled time WITH TIMEZONE CONVERSION
        try:
            if 'T' in scheduled_time:
                scheduled_dt = datetime.strptime(scheduled_time, '%Y-%m-%dT%H:%M')
            else:
                scheduled_dt = datetime.strptime(scheduled_time, '%Y-%m-%d %H:%M')
            
            # Bangladesh timezone conversion
            bd_tz = pytz.timezone('Asia/Dhaka')
            scheduled_dt = bd_tz.localize(scheduled_dt)
            
            # Convert to UTC for database
            post.scheduled_time = scheduled_dt.astimezone(pytz.UTC)
            
        except ValueError as e:
            messages.error(request, '❌ Invalid date/time format')
            return redirect('edit_post', post_id=post_id)
        
        post.save()
        
        messages.success(request, '✅ Post updated successfully')
        return redirect('my_posts')
    
    # Get connected accounts
    connected_accounts = SocialAccount.objects.filter(
        user=request.user, 
        is_active=True
    )
    
    # Convert scheduled time to Bangladesh time for display
    bd_tz = pytz.timezone('Asia/Dhaka')
    scheduled_bd = post.scheduled_time.astimezone(bd_tz)
    
    context = {
        'post': post,
        'connected_accounts': connected_accounts,
        'selected_platforms': post.platforms_list,
        'scheduled_time_local': scheduled_bd.strftime('%Y-%m-%dT%H:%M'),
        'MEDIA_URL': settings.MEDIA_URL,
    }
    
    return render(request, 'posts/edit_post.html', context)


@login_required
def delete_post(request, post_id):
    """Delete post"""
    
    post = get_object_or_404(Post, id=post_id, user=request.user)
    
    if request.method == 'POST':
        # Decrease monthly counter if scheduled
        if post.status == 'scheduled':
            profile = request.user.profile
            profile.posts_this_month = max(0, profile.posts_this_month - 1)
            profile.save()
        
        post.delete()
        messages.success(request, '✅ Post deleted successfully')
    
    return redirect('my_posts')


@login_required
def cancel_post(request, post_id):
    """Cancel scheduled post"""
    
    post = get_object_or_404(Post, id=post_id, user=request.user)
    
    if not post.can_be_cancelled():
        messages.error(request, '❌ This post cannot be cancelled')
        return redirect('my_posts')
    
    if request.method == 'POST':
        post.status = 'cancelled'
        post.save()
        
        messages.success(request, '✅ Post cancelled')
    
    return redirect('my_posts')


@login_required
def generate_caption(request):
    """Generate AI caption"""
    
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            topic = data.get('topic', '').strip()
            tone = data.get('tone', 'professional')
            length = data.get('length', 'medium')
            
            if not topic:
                return JsonResponse({
                    'success': False,
                    'error': 'Topic is required'
                })
            
            # Generate caption using AI
            from ai_caption.services import generate_ai_caption
            
            caption = generate_ai_caption(topic, tone, length)
            
            return JsonResponse({
                'success': True,
                'caption': caption
            })
            
        except Exception as e:
            return JsonResponse({
                'success': False,
                'error': str(e)
            })
    
    return JsonResponse({
        'success': False,
        'error': 'Invalid request method'
    })
