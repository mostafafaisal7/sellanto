# ai_image/product_style_analyzer.py

"""
Product Style Analyzer
Analyzes product images to extract style characteristics for matching background generation.

Features:
- Dominant color extraction
- Color temperature analysis (warm/cool/neutral)
- Lighting detection (soft/hard/natural/studio)
- Style mood classification
- Brightness and contrast analysis
"""

import io
import logging
from PIL import Image
import numpy as np
from typing import Dict, List, Tuple

logger = logging.getLogger(__name__)


class ProductStyleAnalyzer:
    """Analyze product images to extract style, colors, and lighting characteristics"""

    def __init__(self):
        self.analysis_size = (150, 150)  # Resize for faster analysis

    def analyze_image(self, image_data: bytes) -> Dict:
        """
        Comprehensive product image analysis.

        Args:
            image_data: Raw image bytes

        Returns:
            Dictionary containing:
            {
                'dominant_colors': ['#FF6B6B', '#4ECDC4', '#95E1D3'],
                'color_temperature': 'warm',  # or 'cool', 'neutral'
                'brightness': 0.65,  # 0-1 scale
                'contrast': 0.45,    # 0-1 scale
                'lighting_type': 'soft natural',
                'style_mood': 'modern minimalist',
                'sharpness': 0.8,
                'success': True
            }
        """
        try:
            img = Image.open(io.BytesIO(image_data))

            # Convert to RGB if needed
            if img.mode not in ('RGB', 'RGBA'):
                img = img.convert('RGB')
            elif img.mode == 'RGBA':
                # Convert RGBA to RGB with white background
                background = Image.new('RGB', img.size, (255, 255, 255))
                background.paste(img, mask=img.split()[3])
                img = background

            return {
                'dominant_colors': self._extract_colors(img),
                'color_temperature': self._analyze_temperature(img),
                'brightness': self._calculate_brightness(img),
                'contrast': self._calculate_contrast(img),
                'lighting_type': self._detect_lighting(img),
                'style_mood': self._classify_style(img),
                'sharpness': self._measure_sharpness(img),
                'success': True
            }

        except Exception as e:
            logger.error(f"Product style analysis failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'dominant_colors': ['#FFFFFF'],
                'color_temperature': 'neutral',
                'brightness': 0.5,
                'contrast': 0.5,
                'lighting_type': 'balanced lighting',
                'style_mood': 'professional',
                'sharpness': 0.5
            }

    def _extract_colors(self, img: Image, num_colors: int = 5) -> List[str]:
        """
        Extract dominant colors using simple color quantization.

        Args:
            img: PIL Image object
            num_colors: Number of dominant colors to extract

        Returns:
            List of hex color codes
        """
        try:
            # Resize for performance
            img_small = img.copy()
            img_small.thumbnail(self.analysis_size, Image.LANCZOS)

            # Convert to numpy array
            pixels = np.array(img_small).reshape(-1, 3)

            # Simple k-means clustering for color extraction
            # Note: This is a lightweight implementation without sklearn dependency
            colors = self._simple_color_clustering(pixels, num_colors)

            # Convert to hex
            hex_colors = [f'#{r:02x}{g:02x}{b:02x}' for r, g, b in colors]

            return hex_colors

        except Exception as e:
            logger.warning(f"Color extraction failed: {e}")
            return ['#FFFFFF', '#CCCCCC', '#999999']

    def _simple_color_clustering(self, pixels: np.ndarray, k: int = 5) -> List[Tuple[int, int, int]]:
        """
        Simple k-means color clustering without sklearn.

        Args:
            pixels: Nx3 array of RGB pixels
            k: Number of clusters

        Returns:
            List of (R, G, B) tuples
        """
        # Random initialization
        np.random.seed(42)
        indices = np.random.choice(len(pixels), k, replace=False)
        centers = pixels[indices].astype(float)

        # K-means iterations (max 10)
        for _ in range(10):
            # Assign pixels to nearest center
            distances = np.sqrt(((pixels[:, np.newaxis] - centers) ** 2).sum(axis=2))
            labels = distances.argmin(axis=1)

            # Update centers
            new_centers = np.array([pixels[labels == i].mean(axis=0) if (labels == i).any()
                                   else centers[i] for i in range(k)])

            # Check convergence
            if np.allclose(centers, new_centers):
                break

            centers = new_centers

        # Return as integer tuples
        return [(int(r), int(g), int(b)) for r, g, b in centers]

    def _analyze_temperature(self, img: Image) -> str:
        """
        Determine if image has warm/cool/neutral color tones.

        Args:
            img: PIL Image object

        Returns:
            'warm', 'cool', or 'neutral'
        """
        try:
            # Resize for performance
            img_small = img.copy()
            img_small.thumbnail(self.analysis_size, Image.LANCZOS)

            pixels = np.array(img_small)
            avg_r, avg_g, avg_b = pixels.mean(axis=(0, 1))

            # Warm if red-dominant, cool if blue-dominant
            if avg_r > avg_b + 20:
                return 'warm'
            elif avg_b > avg_r + 20:
                return 'cool'
            else:
                return 'neutral'

        except Exception as e:
            logger.warning(f"Temperature analysis failed: {e}")
            return 'neutral'

    def _calculate_brightness(self, img: Image) -> float:
        """
        Calculate average brightness (0-1 scale).

        Args:
            img: PIL Image object

        Returns:
            Brightness value between 0 and 1
        """
        try:
            grayscale = img.convert('L')
            pixels = np.array(grayscale)
            return float(pixels.mean() / 255.0)

        except Exception as e:
            logger.warning(f"Brightness calculation failed: {e}")
            return 0.5

    def _calculate_contrast(self, img: Image) -> float:
        """
        Calculate contrast using standard deviation (0-1 scale).

        Args:
            img: PIL Image object

        Returns:
            Contrast value between 0 and 1
        """
        try:
            grayscale = img.convert('L')
            pixels = np.array(grayscale)
            # Normalize standard deviation to 0-1 range
            return float(min(1.0, pixels.std() / 128.0))

        except Exception as e:
            logger.warning(f"Contrast calculation failed: {e}")
            return 0.5

    def _detect_lighting(self, img: Image) -> str:
        """
        Infer lighting type from brightness and contrast patterns.

        Args:
            img: PIL Image object

        Returns:
            Lighting description string
        """
        try:
            brightness = self._calculate_brightness(img)
            contrast = self._calculate_contrast(img)

            # Lighting type classification based on brightness + contrast
            if contrast > 0.6:
                return 'hard studio lighting'
            elif brightness > 0.7 and contrast < 0.4:
                return 'soft natural lighting'
            elif brightness < 0.4:
                return 'dramatic low-key lighting'
            else:
                return 'balanced diffused lighting'

        except Exception as e:
            logger.warning(f"Lighting detection failed: {e}")
            return 'balanced lighting'

    def _classify_style(self, img: Image) -> str:
        """
        Basic style/mood classification based on visual characteristics.

        Args:
            img: PIL Image object

        Returns:
            Style mood description
        """
        try:
            brightness = self._calculate_brightness(img)
            contrast = self._calculate_contrast(img)

            # Style classification
            if brightness > 0.75 and contrast < 0.35:
                return 'modern minimalist'
            elif contrast > 0.65:
                return 'bold dramatic'
            elif brightness < 0.5:
                return 'moody atmospheric'
            else:
                return 'balanced professional'

        except Exception as e:
            logger.warning(f"Style classification failed: {e}")
            return 'professional'

    def _measure_sharpness(self, img: Image) -> float:
        """
        Measure image sharpness using variance of Laplacian.

        Args:
            img: PIL Image object

        Returns:
            Sharpness value between 0 and 1
        """
        try:
            # Convert to grayscale
            grayscale = np.array(img.convert('L'))

            # Calculate Laplacian (edge detection)
            # Simple approximation: sum of horizontal and vertical differences
            h_diff = np.abs(np.diff(grayscale, axis=0))
            v_diff = np.abs(np.diff(grayscale, axis=1))

            # Combine differences
            sharpness = (h_diff.var() + v_diff.var()) / 2.0

            # Normalize to 0-1 range (typical variance for sharp images: 500-2000)
            return float(min(1.0, sharpness / 1000.0))

        except Exception as e:
            logger.warning(f"Sharpness measurement failed: {e}")
            return 0.5

    def get_color_palette_description(self, colors: List[str]) -> str:
        """
        Generate human-readable description of color palette.

        Args:
            colors: List of hex color codes

        Returns:
            Descriptive string
        """
        if not colors:
            return "neutral tones"

        # Take top 3 colors
        top_colors = colors[:3]
        return f"featuring {', '.join(top_colors)}"

    def get_lighting_description(self, lighting_type: str) -> str:
        """
        Get detailed description for lighting type.

        Args:
            lighting_type: Detected lighting type

        Returns:
            Detailed description
        """
        lighting_map = {
            'soft natural lighting': 'gentle natural light with soft shadows',
            'hard studio lighting': 'crisp studio lighting with defined shadows',
            'dramatic low-key lighting': 'dramatic directional lighting with deep shadows',
            'balanced diffused lighting': 'even diffused lighting without harsh shadows',
        }

        return lighting_map.get(lighting_type, 'professional lighting')
