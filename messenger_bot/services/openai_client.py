# C:\Users\Trust computer\Desktop\Final_version_socialSync\messenger_bot\services\openai_client.py

"""
OpenAI Client Service
Handles OpenAI API interactions for embeddings and chat completions
"""

import openai
import logging
from typing import List, Dict, Optional
import numpy as np

logger = logging.getLogger(__name__)


class OpenAIClient:
    """
    Wrapper for OpenAI API operations
    """
    
    def __init__(self, api_key: str):
        """
        Initialize OpenAI client
        
        Args:
            api_key: OpenAI API key
        """
        self.api_key = api_key
        openai.api_key = api_key
    
    def create_embedding(self, text: str, model: str = "text-embedding-3-small") -> List[float]:
        """
        Create embedding for text
        
        Args:
            text: Text to embed
            model: Embedding model to use
            
        Returns:
            List of floats representing the embedding
        """
        try:
            # Truncate text if too long (max ~8000 tokens for embedding models)
            max_chars = 30000  # Approximate limit
            if len(text) > max_chars:
                text = text[:max_chars]
                logger.warning(f"Text truncated to {max_chars} characters for embedding")
            
            # Create embedding
            response = openai.embeddings.create(
                input=text,
                model=model
            )
            
            embedding = response.data[0].embedding
            logger.debug(f"Created embedding with {len(embedding)} dimensions")
            
            return embedding
        
        except Exception as e:
            logger.error(f"Error creating embedding: {e}")
            raise
    
    def create_embeddings_batch(
        self, 
        texts: List[str], 
        model: str = "text-embedding-3-small"
    ) -> List[List[float]]:
        """
        Create embeddings for multiple texts (batch processing)
        
        Args:
            texts: List of texts to embed
            model: Embedding model to use
            
        Returns:
            List of embeddings
        """
        try:
            embeddings = []
            
            # Process in batches of 100 (API limit)
            batch_size = 100
            for i in range(0, len(texts), batch_size):
                batch = texts[i:i + batch_size]
                
                # Truncate each text
                batch = [text[:30000] for text in batch]
                
                response = openai.embeddings.create(
                    input=batch,
                    model=model
                )
                
                batch_embeddings = [item.embedding for item in response.data]
                embeddings.extend(batch_embeddings)
                
                logger.info(f"Created {len(batch_embeddings)} embeddings (batch {i//batch_size + 1})")
            
            return embeddings
        
        except Exception as e:
            logger.error(f"Error creating batch embeddings: {e}")
            raise
    
    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: str = "gpt-4o-mini",
        temperature: float = 0.7,
        max_tokens: int = 500,
        **kwargs
    ) -> Dict[str, any]:
        """
        Create chat completion
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            model: Model to use
            temperature: Sampling temperature
            max_tokens: Maximum tokens in response
            **kwargs: Additional parameters
            
        Returns:
            dict: {
                'content': str,
                'model': str,
                'tokens': int,
                'finish_reason': str
            }
        """
        try:
            response = openai.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                **kwargs
            )
            
            result = {
                'content': response.choices[0].message.content,
                'model': response.model,
                'tokens': response.usage.total_tokens,
                'finish_reason': response.choices[0].finish_reason
            }
            
            logger.info(f"Chat completion: {result['tokens']} tokens used")
            return result
        
        except Exception as e:
            logger.error(f"Error in chat completion: {e}")
            raise
    
    def analyze_image(
        self,
        image_url: str,
        prompt: str = "What's in this image?",
        model: str = "gpt-4o",
        max_tokens: int = 300
    ) -> str:
        """
        Analyze image using vision model
        
        Args:
            image_url: URL of image to analyze
            prompt: Question about the image
            model: Vision model to use (must support vision)
            max_tokens: Maximum tokens in response
            
        Returns:
            str: Image description/analysis
        """
        try:
            response = openai.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {"url": image_url}
                            }
                        ]
                    }
                ],
                max_tokens=max_tokens
            )
            
            description = response.choices[0].message.content
            logger.info(f"Image analyzed: {len(description)} characters")
            
            return description
        
        except Exception as e:
            logger.error(f"Error analyzing image: {e}")
            raise
    
    def vision_analysis(
        self,
        image_url: str,
        prompt: str = "Describe this image in detail",
        model: str = "gpt-4o"
    ) -> Optional[str]:
        """
        Vision API analysis wrapper for images
        
        Args:
            image_url: URL of image
            prompt: Analysis prompt
            model: Model to use
            
        Returns:
            str: Analysis or None on error
        """
        try:
            return self.analyze_image(
                image_url=image_url,
                prompt=prompt,
                model=model,
                max_tokens=500
            )
        except Exception as e:
            logger.error(f"Vision analysis failed: {e}")
            return None
    
    def cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """
        Calculate cosine similarity between two vectors
        
        Args:
            vec1: First vector
            vec2: Second vector
            
        Returns:
            float: Similarity score (0-1)
        """
        vec1 = np.array(vec1)
        vec2 = np.array(vec2)
        
        dot_product = np.dot(vec1, vec2)
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        similarity = dot_product / (norm1 * norm2)
        return float(similarity)


# Utility functions (outside class)
def cosine_similarity_standalone(vec1: List[float], vec2: List[float]) -> float:
    """
    Standalone cosine similarity function
    
    Args:
        vec1: First vector
        vec2: Second vector
        
    Returns:
        float: Similarity score (0-1)
    """
    vec1 = np.array(vec1)
    vec2 = np.array(vec2)
    
    dot_product = np.dot(vec1, vec2)
    norm1 = np.linalg.norm(vec1)
    norm2 = np.linalg.norm(vec2)
    
    if norm1 == 0 or norm2 == 0:
        return 0.0
    
    similarity = dot_product / (norm1 * norm2)
    return float(similarity)


def find_most_similar(
    query_embedding: List[float],
    embeddings: List[List[float]],
    top_k: int = 3
) -> List[tuple]:
    """
    Find most similar embeddings to query
    
    Args:
        query_embedding: Query vector
        embeddings: List of candidate vectors
        top_k: Number of results to return
        
    Returns:
        List of (index, similarity_score) tuples
    """
    similarities = []
    
    for idx, embedding in enumerate(embeddings):
        similarity = cosine_similarity_standalone(query_embedding, embedding)
        similarities.append((idx, similarity))
    
    # Sort by similarity (descending)
    similarities.sort(key=lambda x: x[1], reverse=True)
    
    return similarities[:top_k]