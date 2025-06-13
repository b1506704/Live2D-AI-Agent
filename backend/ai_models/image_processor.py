import logging
from typing import Optional, Dict, Any, List, Union
from PIL import Image
import torch
from transformers import CLIPProcessor, CLIPModel, BlipProcessor, BlipForConditionalGeneration
import numpy as np
import io
from config import settings

logger = logging.getLogger(__name__)

class ImageProcessor:
    """Manages image understanding and analysis using CLIP and BLIP models"""
    
    def __init__(self):
        self.clip_model: Optional[CLIPModel] = None
        self.clip_processor: Optional[CLIPProcessor] = None
        self.blip_model: Optional[BlipForConditionalGeneration] = None
        self.blip_processor: Optional[BlipProcessor] = None
        self.models_loaded = False
        self._initialize_models()
    
    def _initialize_models(self):
        """Initialize image understanding models"""
        try:
            device = settings.get_device()
            
            # Load CLIP model for image-text similarity
            logger.info(f"Loading CLIP model: {settings.image_model_name}")
            self.clip_processor = CLIPProcessor.from_pretrained(settings.image_model_name)
            self.clip_model = CLIPModel.from_pretrained(settings.image_model_name).to(device)
            
            # Load BLIP model for image captioning
            logger.info("Loading BLIP model for image captioning")
            self.blip_processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
            self.blip_model = BlipForConditionalGeneration.from_pretrained(
                "Salesforce/blip-image-captioning-base"
            ).to(device)
            
            self.models_loaded = True
            logger.info(f"Image processing models loaded successfully on {device}")
            
        except Exception as e:
            logger.error(f"Failed to load image processing models: {e}")
            self.models_loaded = False
    
    def analyze_image(
        self,
        image_data: Union[bytes, Image.Image, np.ndarray],
        generate_caption: bool = True,
        check_similarity: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Analyze an image and extract information
        
        Args:
            image_data: Image as bytes, PIL Image, or numpy array
            generate_caption: Whether to generate a caption
            check_similarity: List of text descriptions to check similarity against
            
        Returns:
            Dictionary with analysis results
        """
        if not self.models_loaded:
            return {"error": "Image processing models not available"}
        
        try:
            # Convert image data to PIL Image
            if isinstance(image_data, bytes):
                image = Image.open(io.BytesIO(image_data))
            elif isinstance(image_data, np.ndarray):
                image = Image.fromarray(image_data)
            else:
                image = image_data
            
            # Ensure RGB format
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Resize if too large
            max_size = settings.max_image_size
            if image.size[0] > max_size[0] or image.size[1] > max_size[1]:
                image.thumbnail(max_size, Image.Resampling.LANCZOS)
            
            results = {
                "size": image.size,
                "mode": image.mode
            }
            
            # Generate caption if requested
            if generate_caption:
                caption = self._generate_caption(image)
                results["caption"] = caption
            
            # Check similarity with provided texts
            if check_similarity:
                similarities = self._compute_similarities(image, check_similarity)
                results["similarities"] = similarities
            
            # Extract visual features
            features = self._extract_features(image)
            results["features"] = {
                "dominant_colors": self._get_dominant_colors(image),
                "brightness": self._calculate_brightness(image),
                "has_text": self._detect_text_presence(features)
            }
            
            return results
            
        except Exception as e:
            logger.error(f"Error analyzing image: {e}")
            return {"error": str(e)}
    
    def _generate_caption(self, image: Image.Image) -> str:
        """Generate a caption for the image"""
        try:
            device = settings.get_device()
            inputs = self.blip_processor(image, return_tensors="pt").to(device)
            
            # Generate caption
            out = self.blip_model.generate(**inputs, max_length=50)
            caption = self.blip_processor.decode(out[0], skip_special_tokens=True)
            
            return caption
            
        except Exception as e:
            logger.error(f"Error generating caption: {e}")
            return "Unable to generate caption"
    
    def _compute_similarities(self, image: Image.Image, texts: List[str]) -> Dict[str, float]:
        """Compute similarity between image and text descriptions"""
        try:
            device = settings.get_device()
            
            # Process image and texts
            inputs = self.clip_processor(
                text=texts,
                images=image,
                return_tensors="pt",
                padding=True
            ).to(device)
            
            # Get features
            outputs = self.clip_model(**inputs)
            logits_per_image = outputs.logits_per_image
            probs = logits_per_image.softmax(dim=1).cpu().numpy()[0]
            
            # Create similarity dictionary
            similarities = {text: float(prob) for text, prob in zip(texts, probs)}
            return similarities
            
        except Exception as e:
            logger.error(f"Error computing similarities: {e}")
            return {}
    
    def _extract_features(self, image: Image.Image) -> torch.Tensor:
        """Extract visual features from the image"""
        try:
            device = settings.get_device()
            inputs = self.clip_processor(images=image, return_tensors="pt").to(device)
            
            with torch.no_grad():
                image_features = self.clip_model.get_image_features(**inputs)
            
            return image_features
            
        except Exception as e:
            logger.error(f"Error extracting features: {e}")
            return torch.tensor([])
    
    def _get_dominant_colors(self, image: Image.Image, n_colors: int = 5) -> List[str]:
        """Extract dominant colors from the image"""
        try:
            # Resize for faster processing
            small_image = image.copy()
            small_image.thumbnail((150, 150))
            
            # Convert to RGB array
            pixels = np.array(small_image)
            pixels = pixels.reshape(-1, 3)
            
            # Simple k-means clustering for dominant colors
            from sklearn.cluster import KMeans
            kmeans = KMeans(n_clusters=n_colors, random_state=42, n_init=10)
            kmeans.fit(pixels)
            
            # Get colors as hex
            colors = []
            for color in kmeans.cluster_centers_:
                hex_color = '#{:02x}{:02x}{:02x}'.format(
                    int(color[0]), int(color[1]), int(color[2])
                )
                colors.append(hex_color)
            
            return colors
            
        except:
            return []
    
    def _calculate_brightness(self, image: Image.Image) -> float:
        """Calculate average brightness of the image"""
        try:
            grayscale = image.convert('L')
            pixels = np.array(grayscale)
            return float(np.mean(pixels) / 255.0)
        except:
            return 0.5
    
    def _detect_text_presence(self, features: torch.Tensor) -> bool:
        """Simple heuristic to detect if image likely contains text"""
        # This is a placeholder - in production, use OCR or specialized model
        return False
    
    def search_similar_images(
        self,
        query_image: Union[bytes, Image.Image],
        image_database: List[Dict[str, Any]],
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """Search for similar images in a database"""
        if not self.models_loaded:
            return []
        
        try:
            # Extract features from query image
            if isinstance(query_image, bytes):
                query_image = Image.open(io.BytesIO(query_image))
            
            query_features = self._extract_features(query_image)
            
            # Compare with database
            similarities = []
            for item in image_database:
                if "features" in item:
                    similarity = torch.cosine_similarity(
                        query_features,
                        item["features"],
                        dim=1
                    ).item()
                    similarities.append({
                        "id": item.get("id"),
                        "similarity": similarity,
                        "metadata": item.get("metadata", {})
                    })
            
            # Sort by similarity and return top k
            similarities.sort(key=lambda x: x["similarity"], reverse=True)
            return similarities[:top_k]
            
        except Exception as e:
            logger.error(f"Error searching similar images: {e}")
            return []
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get information about loaded models"""
        return {
            "models_loaded": self.models_loaded,
            "clip_model": settings.image_model_name if self.clip_model else None,
            "device": settings.get_device(),
            "max_image_size": settings.max_image_size
        }