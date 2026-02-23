# C:\Users\Trust computer\Desktop\Final_version_socialSync\platforms\urls.py

from django.urls import path
from . import views

app_name = 'platforms' 

urlpatterns = [
    path('connect/', views.connect_account, name='connect_account'),
    path('disconnect/<int:account_id>/', views.disconnect_account, name='disconnect_account'),
]