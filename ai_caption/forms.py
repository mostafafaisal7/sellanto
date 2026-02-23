# ai_caption/forms.py

from django import forms
from .models import CaptionGeneration, CaptionTemplate, SavedCaption


class CaptionGenerationForm(forms.ModelForm):
    """Main form for generating captions"""
    
    class Meta:
        model = CaptionGeneration
        fields = [
            'input_text', 'media_file', 'tone', 'length', 'platform',
            'include_hashtags', 'include_emojis', 'include_cta', 'custom_instructions'
        ]
        widgets = {
            'input_text': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 4,
                'placeholder': 'Enter your topic, keywords, or any text you want to generate a caption for...\n\nExamples:\n• "Summer sale 50% off all products"\n• "New coffee shop opening in downtown"\n• "Tips for productivity while working from home"',
            }),
            'media_file': forms.FileInput(attrs={
                'class': 'form-control d-none',
                'id': 'media-upload-input',
                'accept': 'image/*,video/*'
            }),
            'tone': forms.Select(attrs={
                'class': 'form-select'
            }),
            'length': forms.Select(attrs={
                'class': 'form-select'
            }),
            'platform': forms.Select(attrs={
                'class': 'form-select'
            }),
            'include_hashtags': forms.CheckboxInput(attrs={
                'class': 'form-check-input',
                'role': 'switch'
            }),
            'include_emojis': forms.CheckboxInput(attrs={
                'class': 'form-check-input',
                'role': 'switch'
            }),
            'include_cta': forms.CheckboxInput(attrs={
                'class': 'form-check-input',
                'role': 'switch'
            }),
            'custom_instructions': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 2,
                'placeholder': 'Add any specific instructions... (e.g., "mention our brand name TechCo", "include a question", "use formal language")'
            }),
        }
        labels = {
            'input_text': 'Topic / Text',
            'media_file': 'Upload Media',
            'tone': 'Caption Tone',
            'length': 'Caption Length',
            'platform': 'Target Platform',
            'include_hashtags': 'Include Hashtags',
            'include_emojis': 'Include Emojis',
            'include_cta': 'Include Call-to-Action',
            'custom_instructions': 'Custom Instructions (Optional)',
        }
    
    def clean(self):
        cleaned_data = super().clean()
        input_text = cleaned_data.get('input_text')
        media_file = cleaned_data.get('media_file')
        
        # At least one input required
        if not input_text and not media_file:
            raise forms.ValidationError("Please provide either text/topic or upload a media file.")
        
        return cleaned_data
    
    def clean_media_file(self):
        media_file = self.cleaned_data.get('media_file')
        
        if media_file:
            # Check file size (max 100MB)
            if media_file.size > 100 * 1024 * 1024:
                raise forms.ValidationError("File size must be under 100MB.")
            
            # Check file extension
            ext = media_file.name.lower().split('.')[-1]
            allowed_extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 
                                  'mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'm4v']
            
            if ext not in allowed_extensions:
                raise forms.ValidationError(
                    f"Unsupported file format. Allowed: {', '.join(allowed_extensions)}"
                )
        
        return media_file


class QuickCaptionForm(forms.Form):
    """Simplified form for quick caption generation"""
    
    text = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={
            'class': 'form-control',
            'rows': 3,
            'placeholder': 'What do you want to post about?'
        })
    )
    
    media = forms.FileField(
        required=False,
        widget=forms.FileInput(attrs={
            'class': 'form-control d-none',
            'accept': 'image/*,video/*'
        })
    )
    
    tone = forms.ChoiceField(
        choices=CaptionGeneration.TONE_CHOICES,
        initial='professional',
        widget=forms.Select(attrs={'class': 'form-select form-select-sm'})
    )
    
    platform = forms.ChoiceField(
        choices=CaptionGeneration.PLATFORM_CHOICES,
        initial='general',
        widget=forms.Select(attrs={'class': 'form-select form-select-sm'})
    )


class RegenerateCaptionForm(forms.Form):
    """Form for regenerating caption with feedback"""
    
    original_caption = forms.CharField(widget=forms.HiddenInput())
    
    feedback = forms.CharField(
        widget=forms.Textarea(attrs={
            'class': 'form-control',
            'rows': 2,
            'placeholder': 'What would you like to change? (e.g., "make it shorter", "more casual tone", "add urgency")'
        }),
        label="Your Feedback"
    )
    
    tone = forms.ChoiceField(
        choices=CaptionGeneration.TONE_CHOICES,
        required=False,
        widget=forms.Select(attrs={'class': 'form-select'})
    )


class CaptionTemplateForm(forms.ModelForm):
    """Form for creating/editing caption templates"""
    
    class Meta:
        model = CaptionTemplate
        fields = ['name', 'category', 'template_text', 'tone', 'platform']
        widgets = {
            'name': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Template Name'
            }),
            'category': forms.Select(attrs={
                'class': 'form-select'
            }),
            'template_text': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 4,
                'placeholder': 'Template text with placeholders like {topic}, {brand}, {product}...'
            }),
            'tone': forms.Select(attrs={
                'class': 'form-select'
            }),
            'platform': forms.Select(attrs={
                'class': 'form-select'
            }),
        }


class SaveCaptionForm(forms.ModelForm):
    """Form for saving generated captions"""
    
    class Meta:
        model = SavedCaption
        fields = ['caption_text', 'hashtags', 'notes', 'is_favorite']
        widgets = {
            'caption_text': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 4
            }),
            'hashtags': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 2
            }),
            'notes': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 2,
                'placeholder': 'Add notes about this caption...'
            }),
            'is_favorite': forms.CheckboxInput(attrs={
                'class': 'form-check-input'
            }),
        }


class VariationsForm(forms.Form):
    """Form for generating multiple caption variations"""
    
    topic_or_caption = forms.CharField(
        widget=forms.Textarea(attrs={
            'class': 'form-control',
            'rows': 3,
            'placeholder': 'Enter topic or paste existing caption to generate variations...'
        }),
        label="Topic / Caption"
    )
    
    num_variations = forms.ChoiceField(
        choices=[(i, f'{i} variations') for i in range(2, 6)],
        initial=3,
        widget=forms.Select(attrs={'class': 'form-select'}),
        label="Number of Variations"
    )
    
    tone = forms.ChoiceField(
        choices=CaptionGeneration.TONE_CHOICES,
        initial='professional',
        widget=forms.Select(attrs={'class': 'form-select'})
    )
    
    platform = forms.ChoiceField(
        choices=CaptionGeneration.PLATFORM_CHOICES,
        initial='general',
        widget=forms.Select(attrs={'class': 'form-select'})
    )
