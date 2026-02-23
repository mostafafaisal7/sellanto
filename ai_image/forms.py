# ai_image/forms.py

from django import forms
from .models import ImageGeneration, UserLogo, PromptTemplate


class ImageGenerationForm(forms.ModelForm):
    """Form for image generation"""
    
    class Meta:
        model = ImageGeneration
        fields = [
            'title', 'prompt', 'negative_prompt', 'style', 'size', 'quality',
            'logo', 'logo_position', 'logo_size', 'logo_opacity',
            'product_image', 'product_position', 'product_scale',
            'add_lighting', 'camera_angle', 'enhance_prompt', 'seed'
        ]
        widgets = {
            'title': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'e.g., Product Showcase'
            }),
            'prompt': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 4,
                'placeholder': 'Describe your image in detail...'
            }),
            'negative_prompt': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'e.g., blurry, low quality, distorted'
            }),
            'style': forms.Select(attrs={'class': 'form-control'}),
            'size': forms.Select(attrs={'class': 'form-control'}),
            'quality': forms.Select(attrs={'class': 'form-control'}),
            'logo': forms.Select(attrs={'class': 'form-control'}),
            'logo_position': forms.Select(attrs={'class': 'form-control'}),
            'logo_size': forms.NumberInput(attrs={
                'class': 'form-control',
                'min': 5, 'max': 30
            }),
            'logo_opacity': forms.NumberInput(attrs={
                'class': 'form-control',
                'min': 10, 'max': 100
            }),
            'add_lighting': forms.Select(attrs={'class': 'form-control'}),
            'camera_angle': forms.Select(attrs={'class': 'form-control'}),
            'seed': forms.NumberInput(attrs={
                'class': 'form-control',
                'placeholder': 'Optional: seed for reproducibility'
            }),
        }


class QuickGenerateForm(forms.Form):
    """Quick image generation form"""
    
    prompt = forms.CharField(
        widget=forms.Textarea(attrs={
            'class': 'form-control',
            'rows': 3,
            'placeholder': 'Describe your image...'
        })
    )
    style = forms.ChoiceField(
        choices=ImageGeneration.STYLE_CHOICES,
        initial='realistic'
    )


class LogoUploadForm(forms.ModelForm):
    """Form for logo upload"""
    
    class Meta:
        model = UserLogo
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


class PromptTemplateForm(forms.ModelForm):
    """Form for prompt templates"""
    
    class Meta:
        model = PromptTemplate
        fields = [
            'name', 'category', 'prompt_template', 'negative_prompt',
            'recommended_style', 'recommended_size'
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
                'placeholder': 'Use {subject}, {style}, {color} as placeholders'
            }),
            'negative_prompt': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'What to avoid'
            }),
            'recommended_style': forms.Select(attrs={'class': 'form-control'}),
            'recommended_size': forms.Select(attrs={'class': 'form-control'}),
        }
