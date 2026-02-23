# C:\Users\Trust computer\Desktop\Final_version_socialSync\posts\views.py

from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.utils import timezone
from datetime import datetime
import os  # ADD THIS
import time  # ADD THIS
from django.conf import settings  # ADD THIS

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
    
    if request.method == 'POST':
        try:
            # DEBUG: Print all POST data
            print("=" * 50)
            print("POST DATA RECEIVED:")
            for key, value in request.POST.items():
                print(f"{key}: {value}")
            print("=" * 50)
            
            caption = request.POST.get('caption', '').strip()
            scheduled_time = request.POST.get('scheduled_time', '').strip()
            selected_platforms = request.POST.getlist('platforms')
            ai_generated = request.POST.get('ai_generated') == 'true'
            
            # DEBUG: Print extracted values
            print(f"Caption: {caption}")
            print(f"Scheduled Time: {scheduled_time}")
            print(f"Platforms: {selected_platforms}")
            print(f"AI Generated: {ai_generated}")
            
            # Validation
            if not caption:
                print("ERROR: Caption is empty")
                messages.error(request, '❌ Caption is required')
                return redirect('create_post')
            
            if not selected_platforms:
                print("ERROR: No platforms selected")
                messages.error(request, '❌ Please select at least one platform')
                return redirect('create_post')
            
            if not scheduled_time:
                print("ERROR: No scheduled time")
                messages.error(request, '❌ Scheduled time is required')
                return redirect('create_post')
            
            # Parse scheduled time
            try:
                import pytz
                
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
                
                print(f"User input: {scheduled_time}")
                print(f"Saved as UTC: {scheduled_dt}")
                    
            except ValueError as e:
                print(f"ERROR: Date parsing failed: {e}")
                messages.error(request, f'❌ Invalid date/time format: {str(e)}')
                return redirect('create_post')
            
            # Check monthly limit
            profile = request.user.profile
            if profile.posts_this_month >= profile.max_posts_per_month:
                print("ERROR: Monthly limit reached")
                messages.error(request, f'❌ Monthly limit reached ({profile.max_posts_per_month} posts)')
                return redirect('create_post')
            
            # Create post first
            print("Creating post...")
            post = Post.objects.create(
                user=request.user,
                caption=caption,
                scheduled_time=scheduled_dt,
                ai_generated=ai_generated,
                status='scheduled'
            )
            
            print(f"Post created with ID: {post.id}")
            
            # Set platforms
            post.set_platforms(selected_platforms)
            print(f"Platforms set: {selected_platforms}")
            
            # ========================================
            # MULTIPLE MEDIA HANDLING - NEW CODE
            # ========================================
            media_files_list = request.FILES.getlist('media')
            saved_paths = []
            
            print(f"Received {len(media_files_list)} media files")
            
            if len(media_files_list) > 0:
                for idx, uploaded_file in enumerate(media_files_list):
                    # Validate size (50MB max per file)
                    max_size = 50 * 1024 * 1024
                    if uploaded_file.size > max_size:
                        print(f"File {idx+1} too large: {uploaded_file.size / (1024*1024):.2f}MB, skipping")
                        continue
                    
                    # Get extension
                    ext = os.path.splitext(uploaded_file.name)[1].lower()
                    
                    # Validate file type
                    allowed_types = ['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.mov', '.avi']
                    if ext not in allowed_types:
                        print(f"File {idx+1} invalid type: {ext}, skipping")
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
                    print(f"Media {idx+1} saved: {file_path}")
                
                # Save media paths to post
                if saved_paths:
                    post.set_media_files(saved_paths)
                    print(f"Total media files saved: {len(saved_paths)}")
            # ========================================
            # END MULTIPLE MEDIA HANDLING
            # ========================================
            
            post.save()
            print("Post saved successfully!")
            
            # Update monthly counter
            profile.posts_this_month += 1
            profile.save()
            print(f"Monthly counter updated: {profile.posts_this_month}")
            
            messages.success(request, f'✅ Post scheduled for {scheduled_dt.strftime("%B %d, %Y at %I:%M %p")}')
            print("SUCCESS: Redirecting to my_posts")
            return redirect('my_posts')
            
        except Exception as e:
            print(f"EXCEPTION during post creation: {str(e)}")
            import traceback
            traceback.print_exc()
            messages.error(request, f'❌ Failed to create post: {str(e)}')
            return redirect('create_post')
    
    # GET request
    context = {
        'connected_accounts': connected_accounts,
        'platforms': platforms,
        'has_accounts': connected_accounts.exists(),
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
            
            print(f"Edit: User input (BD): {scheduled_time}")
            print(f"Edit: Saved as (UTC): {post.scheduled_time}")
            
        except ValueError as e:
            print(f"Edit: Date parsing error: {e}")
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