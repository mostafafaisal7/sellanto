# ai_video/forms.py

from django import forms
from .models import VideoGeneration, VideoLogo, VideoPromptTemplate


class VideoGenerationForm(forms.ModelForm):
    """Form for video generation"""
    
    class Meta:
        model = VideoGeneration
        fields = [
            'title', 'prompt', 'negative_prompt', 'style', 'duration', 'resolution',
            'aspect_ratio', 'fps', 'logo', 'logo_position', 'logo_size', 'logo_opacity',
            'camera_motion', 'motion_intensity', 'enhance_prompt', 'seed'
        ]
        widgets = {
            'title': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'e.g., Product Demo Video'
            }),
            'prompt': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 4,
                'placeholder': 'Describe your video in detail...'
            }),
            'negative_prompt': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'e.g., blurry, shaky, low quality'
            }),
            'style': forms.Select(attrs={'class': 'form-control'}),
            'duration': forms.Select(attrs={'class': 'form-control'}),
            'resolution': forms.Select(attrs={'class': 'form-control'}),
            'aspect_ratio': forms.Select(attrs={'class': 'form-control'}),
            'fps': forms.Select(attrs={'class': 'form-control'}),
            'logo': forms.Select(attrs={'class': 'form-control'}),
            'logo_position': forms.Select(attrs={'class': 'form-control'}),
            'logo_size': forms.NumberInput(attrs={
                'class': 'form-control',
                'min': 5, 'max': 25
            }),
            'logo_opacity': forms.NumberInput(attrs={
                'class': 'form-control',
                'min': 10, 'max': 100
            }),
            'camera_motion': forms.Select(attrs={'class': 'form-control'}),
            'motion_intensity': forms.Select(attrs={'class': 'form-control'}),
            'seed': forms.NumberInput(attrs={
                'class': 'form-control',
                'placeholder': 'Optional: seed for reproducibility'
            }),
        }


class QuickVideoForm(forms.Form):
    """Quick video generation form"""
    
    prompt = forms.CharField(
        widget=forms.Textarea(attrs={
            'class': 'form-control',
            'rows': 3,
            'placeholder': 'Describe your video...'
        })
    )
    style = forms.ChoiceField(
        choices=VideoGeneration.STYLE_CHOICES,
        initial='cinematic'
    )
    duration = forms.ChoiceField(
        choices=VideoGeneration.DURATION_CHOICES,
        initial=5
    )


class VideoLogoUploadForm(forms.ModelForm):
    """Form for logo upload"""
    
    class Meta:
        model = VideoLogo
        fields = ['name', 'logo_file', 'is_default']
        widgets = {
            'name': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'e.g., My Brand Logo'
            }),
            'logo_file': forms.FileInput(attrs={
                'class': 'form-control',
                'accept': 'image/png,image/jpeg,image/gif,image/webp'
            }),
            'is_default': forms.CheckboxInput(attrs={
                'class': 'form-check-input'
            }),
        }


class VideoPromptTemplateForm(forms.ModelForm):
    """Form for prompt templates"""
    
    class Meta:
        model = VideoPromptTemplate
        fields = [
            'name', 'category', 'prompt_template', 'negative_prompt',
            'recommended_style', 'recommended_duration', 'recommended_aspect_ratio'
        ]
        widgets = {
            'name': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Template name'
            }),
            'category': forms.Select(attrs={'class': 'form-control'}),
            'prompt_template': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 4,
                'placeholder': 'Use {subject}, {action}, {style} as placeholders'
            }),
            'negative_prompt': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'What to avoid'
            }),
            'recommended_style': forms.Select(attrs={'class': 'form-control'}),
            'recommended_duration': forms.Select(attrs={'class': 'form-control'}),
            'recommended_aspect_ratio': forms.Select(attrs={'class': 'form-control'}),
        }
