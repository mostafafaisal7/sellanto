"""
URL configuration for socialsync project.
Django templates for main app + React frontend for frontend routes.
"""
from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView
from .views import ReactAppView

# API and Admin URLs - these take priority
urlpatterns = [
    # Django Admin (built-in)
    path('admin/', admin.site.urls),
    # Note: /admin-panel/ is now handled by React frontend (catch-all route below)

    # REST API for React frontend - ALL API calls go here
    path('api/v1/', include('api.urls')),

    # Django Template Routes (must come BEFORE React catch-all)
    path('accounts/', include('accounts.urls')),
    path('posts/', include('posts.urls')),
    path('platforms/', include('platforms.urls')),
    path('ai-caption/', include('ai_caption.urls')),
    path('ai-image/', include('ai_image.urls')),
    path('business-profile/', include('brands.urls')),

    # API Documentation (Swagger UI)
    path('doc/api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('doc/api/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('doc/api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]

# Static & Media files - serve via Django (cPanel Passenger sends ALL requests to Django)
# WhiteNoise middleware handles /static/ at middleware level (before URL routing)
# These explicit patterns are a fallback safety net
urlpatterns += [
    re_path(r'^static/(?P<path>.*)$', serve, {'document_root': settings.STATIC_ROOT}),
    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
]

# React Frontend - catch-all route (must be LAST)
urlpatterns += [
    re_path(r'^.*$', ReactAppView.as_view(), name='react-app'),
]
