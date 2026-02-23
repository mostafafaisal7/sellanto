"""
Alt Text Generation Service
- LLM vision-based alt text generation
- Max 125 characters for accessibility compliance
"""
import openai
import logging

logger = logging.getLogger(__name__)

MAX_ALT_TEXT_LENGTH = 125


def generate_alt_text(image_generation, api_key):
    """Generate accessibility alt text for an image using LLM vision.

    Args:
        image_generation: ImageGeneration model instance
        api_key: OpenAI API key

    Returns:
        str: Generated alt text (max 125 chars)
    """
    if not api_key:
        return _fallback_alt_text(image_generation)

    # Build context from the image's prompt and title
    context = f"Image title: {image_generation.title or 'Untitled'}\n"
    context += f"Generation prompt: {image_generation.prompt or ''}\n"
    if image_generation.style:
        context += f"Style: {image_generation.style}"

    prompt = f"""Generate a concise, descriptive alt text for an image.

Context about the image:
{context}

Rules:
- Maximum {MAX_ALT_TEXT_LENGTH} characters
- Be descriptive but concise
- Focus on what the image shows, not interpretation
- Don't start with "Image of" or "Photo of"
- Include key visual elements, colors, and subjects

Return only the alt text string, nothing else.
"""

    try:
        client = openai.OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You generate concise image alt text for accessibility."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=100,
        )

        alt_text = response.choices[0].message.content.strip().strip('"')

        # Enforce character limit
        if len(alt_text) > MAX_ALT_TEXT_LENGTH:
            alt_text = alt_text[:MAX_ALT_TEXT_LENGTH - 3] + '...'

    except Exception as e:
        logger.error(f"Alt text generation failed: {e}")
        return _fallback_alt_text(image_generation)

    # Save to model
    image_generation.alt_text = alt_text
    image_generation.save(update_fields=['alt_text'])

    return alt_text


def _fallback_alt_text(image_generation):
    """Generate basic alt text from available metadata."""
    parts = []
    if image_generation.title:
        parts.append(image_generation.title)
    if image_generation.style:
        parts.append(f"{image_generation.style} style")

    alt_text = ', '.join(parts) if parts else 'Generated image'
    if len(alt_text) > MAX_ALT_TEXT_LENGTH:
        alt_text = alt_text[:MAX_ALT_TEXT_LENGTH - 3] + '...'

    image_generation.alt_text = alt_text
    image_generation.save(update_fields=['alt_text'])
    return alt_text
