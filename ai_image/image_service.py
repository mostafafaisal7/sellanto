# ai_image/image_service.py

"""
Unified Image Generation Service
Supports both OpenAI DALL-E and Google Gemini
"""

from .openai_service import OpenAIImageService
from .gemini_service import GeminiImageService


class ImageService:
    """
    Unified interface for image generation
    Automatically uses the appropriate provider based on configuration
    """
    
    def __init__(self, provider='openai', openai_key=None, gemini_key=None):
        self.provider = provider
        self.openai_key = openai_key
        self.gemini_key = gemini_key
        
        # Initialize services
        self.openai_service = OpenAIImageService(api_key=openai_key) if openai_key else None
        self.gemini_service = GeminiImageService(api_key=gemini_key) if gemini_key else None
    
    def get_service(self):
        """Get the appropriate service based on provider setting"""
        if self.provider == 'openai' and self.openai_service:
            return self.openai_service
        elif self.provider == 'gemini' and self.gemini_service:
            return self.gemini_service
        elif self.openai_service:
            return self.openai_service
        elif self.gemini_service:
            return self.gemini_service
        else:
            return None
    
    def generate_image(self, prompt, style='realistic', size='1024x1024', quality='standard',
                       negative_prompt=None, lighting=None, camera_angle=None,
                       enhance=True, seed=None, model=None):
        """
        Generate image using configured provider
        
        Args:
            prompt: Text description of the image
            style: Style preset (realistic, artistic, anime, etc.)
            size: Image dimensions (e.g., '1024x1024')
            quality: Quality level (standard, high, hd)
            negative_prompt: What to avoid in the image
            lighting: Lighting style (natural, studio, dramatic, etc.)
            camera_angle: Camera angle (front, aerial, closeup, etc.)
            enhance: Whether to enhance the prompt with style details
            seed: Random seed for reproducibility (Gemini only)
            model: Specific model to use (dall-e-3, dall-e-2 for OpenAI)
        
        Returns:
            dict with success status, image_data, and metadata
        """
        service = self.get_service()
        
        if not service:
            return {
                'success': False,
                'error': 'No API key configured. Please add your API key in settings.'
            }
        
        # Call the appropriate service
        if isinstance(service, OpenAIImageService):
            # Default to dall-e-3 if not specified
            if not model:
                model = 'dall-e-3'
            
            result = service.generate_image(
                prompt=prompt,
                style=style,
                size=size,
                quality=quality,
                negative_prompt=negative_prompt,
                lighting=lighting,
                camera_angle=camera_angle,
                enhance=enhance,
                seed=seed,
                model=model
            )
            result['provider'] = 'openai'
            result['model_used'] = model
            
        else:  # GeminiImageService
            result = service.generate_image(
                prompt=prompt,
                style=style,
                size=size,
                quality=quality,
                negative_prompt=negative_prompt,
                lighting=lighting,
                camera_angle=camera_angle,
                enhance=enhance,
                seed=seed
            )
            result['provider'] = 'gemini'
            result['model_used'] = 'gemini-2.0-flash'
        
        return result
    
    def add_logo_to_image(self, image_data, logo_path, position='bottom_right',
                          size_percent=10, opacity=100):
        """Add logo to generated image"""
        service = self.get_service()
        
        if service:
            return service.add_logo_to_image(
                image_data=image_data,
                logo_path=logo_path,
                position=position,
                size_percent=size_percent,
                opacity=opacity
            )
        
        return image_data
    
    def test_api_key(self, provider=None):
        """Test API key for specified or current provider"""
        target_provider = provider or self.provider
        
        if target_provider == 'openai' and self.openai_service:
            return self.openai_service.test_api_key()
        elif target_provider == 'gemini' and self.gemini_service:
            return self.gemini_service.test_api_key()
        else:
            return {'success': False, 'error': 'No API key configured for this provider'}
    
    def enhance_prompt(self, prompt, style='realistic', lighting=None, camera_angle=None):
        """Enhance prompt with style details"""
        service = self.get_service()
        
        if service:
            return service.enhance_prompt(prompt, style, lighting, camera_angle)
        
        return prompt
    
    @staticmethod
    def get_provider_info():
        """Get information about available providers"""
        return {
            'openai': {
                'name': 'OpenAI DALL-E',
                'models': [
                    {
                        'id': 'dall-e-3',
                        'name': 'DALL-E 3',
                        'description': 'Best quality, supports HD',
                        'sizes': ['1024x1024', '1792x1024', '1024x1792'],
                        'default': True
                    },
                    {
                        'id': 'dall-e-2',
                        'name': 'DALL-E 2',
                        'description': 'Faster, more economical',
                        'sizes': ['256x256', '512x512', '1024x1024'],
                        'default': False
                    }
                ],
                'features': ['HD Quality', 'Prompt Enhancement', 'Multiple Sizes'],
                'pricing': '$0.04-0.12 per image'
            },
            'gemini': {
                'name': 'Google Gemini',
                'models': [
                    {
                        'id': 'gemini-2.0-flash-exp',
                        'name': 'Gemini 2.0 Flash',
                        'description': 'Experimental image generation',
                        'sizes': ['Any size'],
                        'default': True
                    }
                ],
                'features': ['Flexible Sizes', 'Fast Generation'],
                'pricing': 'Based on usage'
            }
        }
