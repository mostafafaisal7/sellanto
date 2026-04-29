# video_studio/services/prompt_builder.py

"""
BrandDNA Prompt Builder
Inject brand context into Veo prompts for consistent video generation
"""

from PIL import Image
import colorsys
import numpy as np
import io


class BrandDNAPromptBuilder:
    """
    Inject BrandDNA context into Veo prompts for brand-consistent videos
    """

    def build_enhanced_prompt(self, user_prompt, brand, product_image=None, workspace=None):
        """
        Main method: User prompt + BrandDNA → Enhanced Veo prompt

        Args:
            user_prompt (str): Original user prompt
            brand (Brand): Brand model instance
            product_image (str or bytes): Product image path or bytes
            workspace (Workspace): Workspace instance

        Returns:
            str: Enhanced prompt with brand context
        """
        # 1. Extract BrandDNA components
        brand_context = self._extract_brand_context(brand)

        # 2. Analyze product image (if provided)
        product_analysis = None
        if product_image:
            product_analysis = self._analyze_product_image(product_image)

        # 3. Get workspace preferences
        workspace_prefs = self._get_workspace_preferences(workspace) if workspace else {}

        # 4. Build structured prompt
        enhanced = self._construct_veo_prompt(
            user_prompt=user_prompt,
            brand_context=brand_context,
            product_analysis=product_analysis,
            workspace_prefs=workspace_prefs
        )

        return enhanced

    def _extract_brand_context(self, brand):
        """
        Extract relevant info from Brand model

        Args:
            brand (Brand): Brand model instance

        Returns:
            dict: Brand context data
        """
        if not brand:
            return {
                'name': 'Generic Brand',
                'industry': 'general',
                'voice_tone': 'professional',
                'visual_style': 'modern',
                'mood': 'professional'
            }

        brand_dna = brand.brand_dna or {}

        return {
            'name': brand.brand_name,
            'industry': brand.industry if hasattr(brand, 'industry') else 'general',
            'voice_tone': brand.voice_tone if hasattr(brand, 'voice_tone') else 'professional',

            # From BrandDNA JSON
            'primary_color': brand_dna.get('primary_color', '#000000'),
            'secondary_color': brand_dna.get('secondary_color', '#FFFFFF'),
            'color_palette': brand_dna.get('color_palette', []),

            'visual_style': brand_dna.get('visual_style', 'modern'),
            'mood': brand_dna.get('mood', 'professional'),

            # Target audience
            'audiences': brand.audiences if hasattr(brand, 'audiences') else [],
            'goals': brand.goals if hasattr(brand, 'goals') else []
        }

    def _analyze_product_image(self, image_source):
        """
        Analyze product image for visual properties

        Args:
            image_source (str or bytes): Image file path or bytes

        Returns:
            dict: Image analysis data
        """
        try:
            # Load image
            if isinstance(image_source, bytes):
                img = Image.open(io.BytesIO(image_source)).convert('RGB')
            else:
                img = Image.open(image_source).convert('RGB')

            img_array = np.array(img)

            # 1. Extract dominant colors
            dominant_colors = self._get_dominant_colors(img_array, k=5)

            # 2. Calculate brightness/lighting
            brightness = np.mean(img_array)

            if brightness > 200:
                lighting = 'bright, high-key, well-lit'
            elif brightness > 150:
                lighting = 'balanced, natural'
            elif brightness > 100:
                lighting = 'moderate, soft'
            else:
                lighting = 'dark, low-key, moody'

            # 3. Detect background type
            background = self._detect_background_type(img_array)

            # 4. Color temperature
            avg_rgb = np.mean(img_array, axis=(0, 1))
            if avg_rgb[0] > avg_rgb[2]:  # More red than blue
                temperature = 'warm tones'
            else:
                temperature = 'cool tones'

            return {
                'dominant_colors': dominant_colors,
                'brightness': round(brightness, 1),
                'lighting': lighting,
                'background': background,
                'temperature': temperature
            }

        except Exception as e:
            print(f"Failed to analyze product image: {e}")
            return {
                'dominant_colors': ['neutral'],
                'brightness': 150,
                'lighting': 'balanced, natural',
                'background': 'plain background',
                'temperature': 'neutral tones'
            }

    def _get_dominant_colors(self, img_array, k=5):
        """
        Extract k dominant colors using k-means clustering

        Args:
            img_array (numpy.ndarray): Image as numpy array
            k (int): Number of dominant colors to extract

        Returns:
            list: Color names
        """
        try:
            from sklearn.cluster import KMeans

            # Reshape image
            pixels = img_array.reshape(-1, 3)

            # Sample pixels (for performance)
            sample_size = min(10000, len(pixels))
            indices = np.random.choice(len(pixels), sample_size, replace=False)
            sampled = pixels[indices]

            # K-means clustering
            kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
            kmeans.fit(sampled)

            # Get dominant colors
            colors = kmeans.cluster_centers_.astype(int)

            # Convert to hex
            hex_colors = [self._rgb_to_hex(c) for c in colors]

            # Convert to color names
            color_names = [self._hex_to_color_name(h) for h in hex_colors]

            return color_names[:3]  # Return top 3

        except Exception as e:
            print(f"Failed to extract dominant colors: {e}")
            return ['neutral', 'white', 'gray']

    def _rgb_to_hex(self, rgb):
        """Convert RGB to hex"""
        return '#{:02x}{:02x}{:02x}'.format(int(rgb[0]), int(rgb[1]), int(rgb[2]))

    def _hex_to_color_name(self, hex_color):
        """
        Convert hex to descriptive color name

        Args:
            hex_color (str): Hex color code

        Returns:
            str: Color name
        """
        try:
            r = int(hex_color[1:3], 16)
            g = int(hex_color[3:5], 16)
            b = int(hex_color[5:7], 16)

            h, s, v = colorsys.rgb_to_hsv(r/255, g/255, b/255)

            # Determine color
            if s < 0.1:  # Low saturation = grayscale
                if v > 0.9:
                    return 'white'
                elif v < 0.1:
                    return 'black'
                else:
                    return 'gray'

            # Determine hue
            hue_names = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink']
            hue_index = int(h * 8) % 8

            # Add brightness modifier
            if v < 0.3:
                return f'dark {hue_names[hue_index]}'
            elif v > 0.7 and s > 0.5:
                return f'bright {hue_names[hue_index]}'
            else:
                return hue_names[hue_index]

        except Exception as e:
            return 'neutral'

    def _detect_background_type(self, img_array):
        """
        Detect if background is plain, gradient, or complex

        Args:
            img_array (numpy.ndarray): Image as numpy array

        Returns:
            str: Background type description
        """
        try:
            # Calculate color variance
            variance = np.var(img_array, axis=(0, 1))
            avg_variance = np.mean(variance)

            if avg_variance < 100:
                return 'solid/plain background'
            elif avg_variance < 1000:
                return 'gradient background'
            else:
                return 'textured/complex background'

        except:
            return 'plain background'

    def _get_workspace_preferences(self, workspace):
        """
        Extract workspace-level preferences

        Args:
            workspace (Workspace): Workspace instance

        Returns:
            dict: Workspace preferences
        """
        if not workspace:
            return {}

        return {
            'default_language': workspace.default_language if hasattr(workspace, 'default_language') else 'en',
            'timezone': workspace.timezone if hasattr(workspace, 'timezone') else 'UTC'
        }

    def _construct_veo_prompt(self, user_prompt, brand_context, product_analysis, workspace_prefs):
        """
        Build final enhanced prompt for Veo

        Args:
            user_prompt (str): Original user prompt
            brand_context (dict): Brand context data
            product_analysis (dict): Product image analysis
            workspace_prefs (dict): Workspace preferences

        Returns:
            str: Enhanced Veo prompt
        """
        # Start with user's prompt
        prompt_parts = [user_prompt]

        # Add brand visual style
        visual_style = self._get_visual_style_description(brand_context)
        prompt_parts.append(f"\n\nVisual Style: {visual_style}")

        # Add color guidance
        if brand_context.get('color_palette') and len(brand_context['color_palette']) > 0:
            colors_desc = ', '.join(brand_context['color_palette'][:3])
            prompt_parts.append(f"Brand Colors: Incorporate {colors_desc} palette")
        elif brand_context.get('primary_color') and brand_context['primary_color'] != '#000000':
            prompt_parts.append(f"Brand Color: {brand_context['primary_color']}")

        # Add product-specific lighting
        if product_analysis:
            prompt_parts.append(f"Lighting: {product_analysis['lighting']}")
            prompt_parts.append(f"Color Temperature: {product_analysis['temperature']}")

            # Add dominant colors for consistency
            if product_analysis['dominant_colors']:
                colors_str = ', '.join(product_analysis['dominant_colors'])
                prompt_parts.append(f"Product Colors: {colors_str}")

        # Add mood/tone
        mood = brand_context.get('mood', 'professional')
        voice_tone = brand_context.get('voice_tone', 'professional')
        prompt_parts.append(f"Mood: {mood}, {voice_tone}")

        # Add industry-specific guidance
        industry_style = self._get_industry_style(brand_context.get('industry', ''))
        if industry_style:
            prompt_parts.append(f"Industry Style: {industry_style}")

        # Technical requirements
        prompt_parts.append("\nTechnical Requirements:")
        prompt_parts.append("- Duration: 8 seconds")
        prompt_parts.append("- Quality: Professional, cinematic")
        prompt_parts.append("- Camera: Smooth, intentional movements")
        prompt_parts.append("- Audio: Subtle ambient sound")

        # Combine all parts
        final_prompt = '\n'.join(prompt_parts)

        # Ensure within Veo's character limit (~500 chars recommended)
        if len(final_prompt) > 500:
            final_prompt = self._compress_prompt(final_prompt, max_length=500)

        return final_prompt

    def _get_visual_style_description(self, brand_context):
        """
        Convert brand voice to visual style

        Args:
            brand_context (dict): Brand context data

        Returns:
            str: Visual style description
        """
        style_map = {
            'professional': 'Clean, modern, sophisticated cinematography',
            'casual': 'Relaxed, natural, approachable visuals',
            'playful': 'Dynamic, colorful, energetic camera work',
            'elegant': 'Refined, graceful, high-end aesthetic',
            'bold': 'Striking, confident, dramatic visuals',
            'minimalist': 'Simple, uncluttered, focused composition',
            'luxury': 'Premium, sophisticated, high-end production',
            'friendly': 'Warm, inviting, accessible presentation',
        }

        tone = brand_context.get('voice_tone', 'professional')
        return style_map.get(tone, 'Professional, high-quality')

    def _get_industry_style(self, industry):
        """
        Industry-specific visual guidance

        Args:
            industry (str): Industry name

        Returns:
            str: Industry-specific style guidance
        """
        industry_styles = {
            'technology': 'Modern, sleek, futuristic with clean lines',
            'tech': 'Modern, sleek, futuristic with clean lines',
            'fashion': 'Stylish, trend-forward, elegant presentation',
            'food & beverage': 'Appetizing, vibrant colors, natural lighting',
            'food': 'Appetizing, vibrant colors, natural lighting',
            'beauty': 'Soft, flattering lighting, luxurious feel',
            'cosmetics': 'Soft, flattering lighting, luxurious feel',
            'sports': 'Dynamic, energetic, action-focused',
            'fitness': 'Dynamic, energetic, action-focused',
            'automotive': 'Powerful, sleek, cinematic reveals',
            'real estate': 'Spacious, inviting, well-lit interiors',
            'jewelry': 'Detailed, sparkle, luxury presentation',
            'electronics': 'Clean, modern, feature-focused',
            'home & garden': 'Warm, cozy, lifestyle-oriented',
        }

        return industry_styles.get(industry.lower(), None)

    def _compress_prompt(self, prompt, max_length=500):
        """
        Compress prompt if too long while keeping key info

        Args:
            prompt (str): Original prompt
            max_length (int): Maximum character length

        Returns:
            str: Compressed prompt
        """
        # Remove extra whitespace
        compressed = ' '.join(prompt.split())

        if len(compressed) <= max_length:
            return compressed

        # Keep user prompt and most important parts
        lines = compressed.split('\n')

        # Always keep first line (user prompt)
        result = [lines[0]]
        current_length = len(lines[0])

        # Add other lines until we hit limit
        for line in lines[1:]:
            if current_length + len(line) + 1 <= max_length - 3:
                result.append(line)
                current_length += len(line) + 1
            else:
                break

        return '\n'.join(result)


# Preset prompt templates for common scenarios

PROMPT_TEMPLATES = {
    'product_360': {
        'base': 'Smooth 360-degree orbit around {product_name}, showcasing all angles',
        'camera': 'camera orbiting horizontally',
        'lighting': 'even studio lighting'
    },

    'hero_reveal': {
        'base': 'Dramatic reveal of {product_name} with cinematic flair',
        'camera': 'slow dolly-in from wide to medium shot',
        'lighting': 'dramatic spotlight with gradual reveal'
    },

    'detail_closeup': {
        'base': 'Extreme close-up of {product_name}, highlighting texture and craftsmanship',
        'camera': 'macro shot with slow pan',
        'lighting': 'soft directional lighting to emphasize detail'
    },

    'lifestyle_usage': {
        'base': 'Person naturally using {product_name} in everyday setting',
        'camera': 'handheld, subtle movement',
        'lighting': 'natural ambient lighting'
    },

    'features_showcase': {
        'base': 'Highlighting key features of {product_name}',
        'camera': 'smooth pan across features with subtle zoom',
        'lighting': 'bright, even illumination'
    },

    'unboxing_reveal': {
        'base': 'Unboxing experience of {product_name}, from package to reveal',
        'camera': 'overhead shot, tilting down',
        'lighting': 'soft overhead lighting'
    },

    'comparison': {
        'base': '{product_name} side-by-side comparison with alternative',
        'camera': 'static or slow pan between items',
        'lighting': 'even, neutral lighting for fair comparison'
    },

    'in_action': {
        'base': '{product_name} in action, demonstrating functionality',
        'camera': 'dynamic tracking shot',
        'lighting': 'natural, action-appropriate lighting'
    }
}


def get_template_prompt(template_name, product_name, brand=None):
    """
    Get a pre-built prompt template

    Args:
        template_name (str): Template name from PROMPT_TEMPLATES
        product_name (str): Product name
        brand (Brand): Optional brand for enhancement

    Returns:
        dict: Template with filled-in product name
    """
    template = PROMPT_TEMPLATES.get(template_name)

    if not template:
        return None

    filled_template = {
        'prompt': template['base'].format(product_name=product_name),
        'camera_movement': template.get('camera', ''),
        'lighting_style': template.get('lighting', '')
    }

    return filled_template
