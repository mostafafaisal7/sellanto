# C:\Users\Trust computer\Desktop\Final_version_socialSync\accounts\views.py

from django.shortcuts import render, redirect
from django.contrib.auth import login, logout, authenticate
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.contrib import messages
from django.core.mail import send_mail
from django.conf import settings
from .models import UserProfile
import re

def register(request):
    """User registration with admin approval"""
    
    if request.user.is_authenticated:
        return redirect('dashboard')
    
    if request.method == 'POST':
        # Get form data
        username = request.POST.get('username', '').strip()
        email = request.POST.get('email', '').strip()
        password = request.POST.get('password', '')
        password_confirm = request.POST.get('password_confirm', '')
        phone = request.POST.get('phone', '').strip()
        company = request.POST.get('company', '').strip()
        
        # Validation
        errors = []
        
        if not username or len(username) < 3:
            errors.append('Username must be at least 3 characters long')
        
        if not re.match(r'^[a-zA-Z0-9_]+$', username):
            errors.append('Username can only contain letters, numbers, and underscores')
        
        if User.objects.filter(username=username).exists():
            errors.append('Username already taken')
        
        if not email or '@' not in email:
            errors.append('Valid email is required')
        
        if User.objects.filter(email=email).exists():
            errors.append('Email already registered')
        
        if len(password) < 6:
            errors.append('Password must be at least 6 characters long')
        
        if password != password_confirm:
            errors.append('Passwords do not match')
        
        if errors:
            for error in errors:
                messages.error(request, error)
            return render(request, 'accounts/register.html', {
                'username': username,
                'email': email,
                'phone': phone,
                'company': company,
            })
        
        # Create user
        try:
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password
            )
            
            # Update profile
            profile = user.profile
            profile.phone = phone
            profile.company = company
            profile.is_approved = False  # Requires admin approval
            profile.save()
            
            messages.success(request, '✅ Registration successful! Please wait for admin approval.')
            
            # Send notification to admin (optional)
            # TODO: Send email to admin
            
            return redirect('login')
            
        except Exception as e:
            messages.error(request, f'Registration failed: {str(e)}')
    
    return render(request, 'accounts/register.html')


def user_login(request):
    """User login"""
    
    if request.user.is_authenticated:
        return redirect('dashboard')
    
    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        password = request.POST.get('password', '')
        
        # Try to authenticate
        user = authenticate(request, username=username, password=password)
        
        if user is not None:
            # Check if approved (skip for admin)
            if user.is_staff or user.is_superuser:
                login(request, user)
                messages.success(request, f'Welcome back, {user.username}!')
                return redirect('admin_dashboard')
            
            elif user.profile.is_approved:
                login(request, user)
                messages.success(request, f'Welcome back, {user.username}!')
                return redirect('dashboard')
            
            else:
                messages.warning(request, '⏳ Your account is pending admin approval.')
        else:
            messages.error(request, '❌ Invalid username or password')
    
    return render(request, 'accounts/login.html')


@login_required
def user_logout(request):
    """User logout"""
    logout(request)
    messages.success(request, 'You have been logged out successfully.')
    return redirect('login')


@login_required
def dashboard(request):
    """User dashboard - main page after login"""
    
    # Check if user is admin
    if request.user.is_staff or request.user.is_superuser:
        return redirect('admin_dashboard')
    
    # Check if approved
    if not request.user.profile.is_approved:
        messages.warning(request, 'Your account is pending admin approval.')
        logout(request)
        return redirect('login')
    
    # Get statistics
    from posts.models import Post
    total_posts = Post.objects.filter(user=request.user).count()
    scheduled_posts = Post.objects.filter(user=request.user, status='scheduled').count()
    posted_posts = Post.objects.filter(user=request.user, status='posted').count()
    
    # Calculate remaining posts
    profile = request.user.profile
    remaining_posts = profile.max_posts_per_month - profile.posts_this_month
    
    context = {
        'user': request.user,
        'profile': profile,
        'total_posts': total_posts,
        'scheduled_posts': scheduled_posts,
        'posted_posts': posted_posts,
        'remaining_posts': remaining_posts,
    }
    
    return render(request, 'accounts/dashboard.html', context)

@login_required
def profile(request):
    """User profile management"""
    
    profile = request.user.profile
    
    if request.method == 'POST':
        # Update profile
        phone = request.POST.get('phone', '').strip()
        company = request.POST.get('company', '').strip()
        
        profile.phone = phone
        profile.company = company
        
        # Handle avatar upload
        if 'avatar' in request.FILES:
            profile.avatar = request.FILES['avatar']
        
        profile.save()
        
        # Update user info
        email = request.POST.get('email', '').strip()
        if email and email != request.user.email:
            if not User.objects.filter(email=email).exclude(id=request.user.id).exists():
                request.user.email = email
                request.user.save()
        
        messages.success(request, '✅ Profile updated successfully!')
        return redirect('profile')
    
    context = {
        'user': request.user,
        'profile': profile,
    }
    
    return render(request, 'accounts/profile.html', context)


@login_required
def admin_dashboard(request):
    """Admin dashboard - for staff/superuser only"""
    
    if not (request.user.is_staff or request.user.is_superuser):
        messages.error(request, 'Access denied. Admin only.')
        return redirect('dashboard')
    
    # Get statistics
    total_users = User.objects.count()
    pending_users = UserProfile.objects.filter(is_approved=False).count()
    approved_users = UserProfile.objects.filter(is_approved=True).count()
    
    # Get recent registrations
    recent_users = UserProfile.objects.select_related('user').order_by('-created_at')[:10]
    
    context = {
        'total_users': total_users,
        'pending_users': pending_users,
        'approved_users': approved_users,
        'recent_users': recent_users,
    }
    
    return render(request, 'accounts/admin_dashboard.html', context)