from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from .models import Workspace, Brand, LaunchPlan


@login_required
def business_profile(request):
    """Business Profile page - manage workspaces and brands"""

    workspaces = Workspace.objects.filter(owner=request.user, is_active=True)
    brands = Brand.objects.filter(user=request.user)

    context = {
        'workspaces': workspaces,
        'brands': brands,
    }

    return render(request, 'brands/business_profile.html', context)


@login_required
def create_workspace(request):
    """Create a new workspace"""
    if request.method == 'POST':
        name = request.POST.get('name', '').strip()
        ws_timezone = request.POST.get('timezone', 'UTC')
        language = request.POST.get('language', 'en')

        if not name:
            messages.error(request, 'Workspace name is required')
            return redirect('business_profile')

        Workspace.objects.create(
            owner=request.user,
            name=name,
            timezone=ws_timezone,
            default_language=language,
        )
        messages.success(request, f'Workspace "{name}" created successfully!')

    return redirect('business_profile')


@login_required
def create_brand(request):
    """Create a new brand"""
    if request.method == 'POST':
        workspace_id = request.POST.get('workspace_id')
        brand_name = request.POST.get('brand_name', '').strip()
        industry = request.POST.get('industry', '').strip()
        target_region = request.POST.get('target_region', '').strip()
        website_url = request.POST.get('website_url', '').strip()
        voice_tone = request.POST.get('voice_tone', 'professional')

        if not workspace_id or not brand_name or not industry:
            messages.error(request, 'Workspace, brand name, and industry are required')
            return redirect('business_profile')

        try:
            workspace = Workspace.objects.get(id=workspace_id, owner=request.user)
        except Workspace.DoesNotExist:
            messages.error(request, 'Workspace not found')
            return redirect('business_profile')

        brand = Brand.objects.create(
            workspace=workspace,
            user=request.user,
            brand_name=brand_name,
            industry=industry,
            target_region=target_region,
            website_url=website_url or None,
            voice_tone=voice_tone,
        )

        # Create default launch plan
        LaunchPlan.objects.create(brand=brand)

        messages.success(request, f'Brand "{brand_name}" created successfully!')

    return redirect('business_profile')
