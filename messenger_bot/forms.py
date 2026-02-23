# C:\Users\Trust computer\Desktop\Final_version_socialSync\messenger_bot\forms.py
 
"""
Messenger Bot Forms
Forms for connecting Facebook Messenger and configuring AI
"""

from django import forms
from django.utils.safestring import mark_safe
from .models import MessengerConnection, AIConfiguration, CustomPrompt


class MessengerConnectionForm(forms.ModelForm):
    """Form for connecting Facebook Messenger Page"""
    
    class Meta:
        model = MessengerConnection
        fields = ['page_name', 'page_id', 'page_access_token', 'greeting_text']
        widgets = {
            'page_name': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'My Business Page'
            }),
            'page_id': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': '123456789012345'
            }),
            'page_access_token': forms.Textarea(attrs={
                'class': 'form-control',
                'placeholder': 'EAAxxxxxxxxxx...',
                'rows': 4
            }),
            'greeting_text': forms.Textarea(attrs={
                'class': 'form-control',
                'placeholder': 'Hi! I\'m an AI assistant. How can I help you today?',
                'rows': 3
            }),
        }
        help_texts = {
            'page_name': 'Your Facebook Page name',
            'page_id': 'Get from Graph API Explorer',
            'page_access_token': 'Long-lived Page Access Token',
            'greeting_text': 'First message users see when they start a conversation'
        }


class AIConfigurationForm(forms.ModelForm):
    """Form for configuring OpenAI and AI settings"""
    
    class Meta:
        model = AIConfiguration
        fields = [
            'openai_api_key',
            'openai_model',
            'embedding_model',
            'rag_enabled',
            'top_k_results',
            'similarity_threshold',
            'temperature',
            'max_tokens',
            'image_understanding_enabled',
            'voice_transcription_enabled',
            'voice_reply_enabled',
            'voice_model'
        ]
        widgets = {
            'openai_api_key': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'sk-...'
            }),
            'openai_model': forms.Select(attrs={
                'class': 'form-control'
            }),
            'embedding_model': forms.Select(attrs={
                'class': 'form-control'
            }),
            'rag_enabled': forms.CheckboxInput(attrs={
                'class': 'form-check-input',
                'checked': True  # ← Add this
            }),
            'top_k_results': forms.NumberInput(attrs={
                'class': 'form-control',
                'min': 1,
                'max': 10,
                'value': 3  # ← Add this
            }),
            'similarity_threshold': forms.NumberInput(attrs={
                'class': 'form-control',
                'step': 0.1,
                'min': 0,
                'max': 1,
                'value': 0.7  # ← Add this
            }),
            'temperature': forms.NumberInput(attrs={
                'class': 'form-control',
                'step': 0.1,
                'min': 0,
                'max': 2,
                'value': 0.7  # ← Add this
            }),
            'max_tokens': forms.NumberInput(attrs={
                'class': 'form-control',
                'min': 100,
                'max': 4000,
                'value': 1500  # Increased for complete responses
            }),
            'image_understanding_enabled': forms.CheckboxInput(attrs={
                'class': 'form-check-input',
                'checked': True  # ← Add this
            }),
            'voice_transcription_enabled': forms.CheckboxInput(attrs={
                'class': 'form-check-input',
                'checked': True
            }),
            'voice_reply_enabled': forms.CheckboxInput(attrs={
                'class': 'form-check-input'
            }),
            'voice_model': forms.Select(attrs={
                'class': 'form-control'
            }),
        }


class CustomPromptForm(forms.ModelForm):
    """Form for creating custom AI prompts"""
    
    class Meta:
        model = CustomPrompt
        fields = ['name', 'system_prompt', 'tone', 'is_active']
        widgets = {
            'name': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'E.g., Customer Support Assistant'
            }),
            'system_prompt': forms.Textarea(attrs={
                'class': 'form-control',
                'placeholder': 'You are a helpful assistant...',
                'rows': 8
            }),
            'tone': forms.Select(attrs={
                'class': 'form-control'
            }),
            'is_active': forms.CheckboxInput(attrs={
                'class': 'form-check-input'
            }),
        }
        help_texts = {
            'name': 'Give your prompt a descriptive name',
            'system_prompt': 'Define how your AI should behave and respond',
            'tone': 'Select the conversation style',
            'is_active': 'Only one prompt can be active at a time'
        }


# Custom widget for multiple file upload
class MultipleFileInput(forms.FileInput):
    """
    Custom widget that supports multiple file selection
    Bypasses Django's built-in restriction by overriding render
    """
    
    def render(self, name, value, attrs=None, renderer=None):
        """Override render to add 'multiple' attribute in HTML"""
        if attrs is None:
            attrs = {}
        
        # Add multiple attribute here (bypasses __init__ validation)
        attrs['multiple'] = 'multiple'
        
        # Call parent render
        return super().render(name, value, attrs, renderer)


class PDFUploadForm(forms.Form):
    """Form for uploading multiple PDFs"""
    
    pdfs = forms.FileField(
        widget=MultipleFileInput(attrs={
            'accept': '.pdf',
            'class': 'form-control'
            # Note: 'multiple' is added in render() method, not here
        }),
        required=False,
        help_text='Upload PDF files to build your knowledge base (optional)'
    )
    
    def clean_pdfs(self):
        """Validate PDF files"""
        files = self.files.getlist('pdfs')
        
        if not files:
            return []
        
        for file in files:
            # Check file extension
            if not file.name.lower().endswith('.pdf'):
                raise forms.ValidationError(
                    f'{file.name} is not a PDF file. Only PDF files are allowed.'
                )
            
            # Check file size (max 50MB)
            if file.size > 50 * 1024 * 1024:
                raise forms.ValidationError(
                    f'{file.name} is too large. Maximum file size is 50MB.'
                )
        
        return files