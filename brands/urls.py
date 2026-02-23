from django.urls import path
from . import views

app_name = 'brands'

urlpatterns = [
    path('', views.business_profile, name='business_profile'),
    path('create-workspace/', views.create_workspace, name='create_workspace'),
    path('create-brand/', views.create_brand, name='create_brand'),
]
