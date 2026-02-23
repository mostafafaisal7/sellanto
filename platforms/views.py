# C:\Users\Trust computer\Desktop\Final_version_socialSync\platforms\views.py


from django.shortcuts import render

# Create your views here.
from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from .models import SocialAccount
from .services.facebook import FacebookService
from .services.twitter import TwitterService
from .services.linkedin import LinkedInService
from .services.instagram import InstagramService

@login_required
def connect_account(request):
    """Connect new social media account"""
    
    if request.method == 'POST':
        platform = request.POST.get('platform')
        
        # Check if user can add more accounts
        if not request.user.profile.can_add_account():
            messages.error(request, f'❌ You have reached your account limit ({request.user.profile.max_social_accounts})')
            return redirect('connect_account')
        
        # Platform-specific handling
        if platform == 'facebook':
            return handle_facebook_connect(request)
        elif platform == 'twitter':
            return handle_twitter_connect(request)
        elif platform == 'instagram':
            return handle_instagram_connect(request)
        elif platform == 'linkedin':
            return handle_linkedin_connect(request)
        else:
            messages.error(request, '❌ Platform not supported yet')
    
    # Get user's connected accounts
    connected_accounts = SocialAccount.objects.filter(user=request.user, is_active=True)
    
    context = {
        'connected_accounts': connected_accounts,
        'can_add_account': request.user.profile.can_add_account(),
    }
    
    return render(request, 'platforms/connect_account.html', context)


def handle_facebook_connect(request):
    """Handle Facebook account connection"""
    page_id = request.POST.get('facebook_page_id', '').strip()
    access_token = request.POST.get('facebook_access_token', '').strip()
    
    if not page_id or not access_token:
        messages.error(request, '❌ Page ID and Access Token are required')
        return redirect('connect_account')
    
    # Validate credentials
    success, result = FacebookService.validate_credentials(page_id, access_token)
    
    if not success:
        messages.error(request, f'❌ Facebook validation failed: {result}')
        return redirect('connect_account')
    
    page_name = result
    
    # Create or update account
    account, created = SocialAccount.objects.update_or_create(
        user=request.user,
        platform='facebook',
        account_name=page_name,
        defaults={
            'facebook_page_id': page_id,
            'facebook_access_token': access_token,
            'status': 'active',
            'is_active': True,
            'is_validated': True,
        }
    )
    
    action = 'connected' if created else 'updated'
    messages.success(request, f'✅ Facebook page "{page_name}" {action} successfully!')
    
    return redirect('connect_account')


def handle_twitter_connect(request):
    """Handle Twitter account connection"""
    api_key = request.POST.get('twitter_api_key', '').strip()
    api_secret = request.POST.get('twitter_api_secret', '').strip()
    access_token = request.POST.get('twitter_access_token', '').strip()
    access_token_secret = request.POST.get('twitter_access_token_secret', '').strip()
    
    if not all([api_key, api_secret, access_token, access_token_secret]):
        messages.error(request, '❌ All Twitter credentials are required')
        return redirect('connect_account')
    
    # Validate credentials
    success, result = TwitterService.validate_credentials(
        api_key, api_secret, access_token, access_token_secret
    )
    
    if not success:
        messages.error(request, f'❌ Twitter validation failed: {result}')
        return redirect('connect_account')
    
    username = result
    
    # Create or update account
    account, created = SocialAccount.objects.update_or_create(
        user=request.user,
        platform='twitter',
        account_name=username,
        defaults={
            'twitter_api_key': api_key,
            'twitter_api_secret': api_secret,
            'twitter_access_token': access_token,
            'twitter_access_token_secret': access_token_secret,
            'status': 'active',
            'is_active': True,
            'is_validated': True,
        }
    )
    
    action = 'connected' if created else 'updated'
    messages.success(request, f'✅ Twitter account "{username}" {action} successfully!')
    
    return redirect('connect_account')


def handle_instagram_connect(request):
    """Handle Instagram account connection"""
    access_token = request.POST.get('instagram_access_token', '').strip()
    business_account_id = request.POST.get('instagram_business_account_id', '').strip()
    
    if not access_token or not business_account_id:
        messages.error(request, '❌ Access Token and Business Account ID are required')
        return redirect('connect_account')
    
    # Validate credentials
    success, result = InstagramService.validate_credentials(access_token, business_account_id)
    
    if not success:
        messages.error(request, f'❌ Instagram validation failed: {result}')
        return redirect('connect_account')
    
    username = result
    
    # Create or update account
    account, created = SocialAccount.objects.update_or_create(
        user=request.user,
        platform='instagram',
        account_name=username,
        defaults={
            'instagram_access_token': access_token,
            'instagram_business_account_id': business_account_id,
            'status': 'active',
            'is_active': True,
            'is_validated': True,
        }
    )
    
    action = 'connected' if created else 'updated'
    messages.success(request, f'✅ Instagram account "{username}" {action} successfully!')
    
    return redirect('connect_account')


def handle_linkedin_connect(request):
    """Handle LinkedIn account connection"""
    access_token = request.POST.get('linkedin_access_token', '').strip()
    person_urn = request.POST.get('linkedin_person_urn', '').strip()
    
    if not access_token or not person_urn:
        messages.error(request, '❌ Access Token and Person URN are required')
        return redirect('connect_account')
    
    # Validate credentials
    success, result = LinkedInService.validate_credentials(access_token, person_urn)
    
    if not success:
        messages.error(request, f'❌ LinkedIn validation failed: {result}')
        return redirect('connect_account')
    
    name = result
    
    # Create or update account
    account, created = SocialAccount.objects.update_or_create(
        user=request.user,
        platform='linkedin',
        account_name=name,
        defaults={
            'linkedin_access_token': access_token,
            'linkedin_person_urn': person_urn,
            'status': 'active',
            'is_active': True,
            'is_validated': True,
        }
    )
    
    action = 'connected' if created else 'updated'
    messages.success(request, f'✅ LinkedIn account "{name}" {action} successfully!')
    
    return redirect('connect_account')


@login_required
def disconnect_account(request, account_id):
    """Disconnect social media account"""
    try:
        account = SocialAccount.objects.get(id=account_id, user=request.user)
        account_name = account.account_name
        account.delete()
        messages.success(request, f'✅ {account_name} disconnected successfully!')
    except SocialAccount.DoesNotExist:
        messages.error(request, '❌ Account not found')
    
    return redirect('connect_account')