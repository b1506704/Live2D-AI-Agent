import logging
import torch
import numpy as np
from typing import Optional, Tuple, Dict, Any
from TTS.api import TTS
import io
import wave
from config import settings
import tempfile
import os

logger = logging.getLogger(__name__)

class TTSManager:
    """Manages Text-to-Speech using Coqui TTS"""
    
    def __init__(self):
        self.english_model: Optional[TTS] = None
        self.japanese_model: Optional[TTS] = None
        self.models_loaded = False
        self._initialize_models()
    
    def _initialize_models(self):
        """Initialize TTS models for different languages"""
        try:
            # Initialize English TTS
            logger.info("Loading English TTS model...")
            self.english_model = TTS(
                model_name=settings.tts_model_name,
                vocoder_name=settings.tts_vocoder_name,
                gpu=settings.tts_use_cuda
            )
            
            # Initialize Japanese TTS
            logger.info("Loading Japanese TTS model...")
            self.japanese_model = TTS(
                model_name=settings.tts_japanese_model,
                gpu=settings.tts_use_cuda
            )
            
            self.models_loaded = True
            logger.info("TTS models loaded successfully")
            
            if settings.tts_use_cuda:
                logger.info("TTS running on GPU")
            else:
                logger.info("TTS running on CPU")
                
        except Exception as e:
            logger.error(f"Failed to load TTS models: {e}")
            self.models_loaded = False
    
    def synthesize(
        self,
        text: str,
        language: str = "en",
        speaker_id: Optional[int] = None,
        emotion: Optional[str] = None,
        speed: float = 1.0
    ) -> Tuple[bytes, Dict[str, Any]]:
        """
        Synthesize speech from text
        
        Args:
            text: Text to synthesize
            language: Language code ('en' or 'ja')
            speaker_id: Optional speaker ID for multi-speaker models
            emotion: Optional emotion for emotional TTS models
            speed: Speech speed multiplier (1.0 = normal)
            
        Returns:
            Tuple of (audio_bytes, metadata)
        """
        if not self.models_loaded:
            return b"", {"error": "TTS models not available"}
        
        try:
            # Select appropriate model
            if language == "ja":
                model = self.japanese_model
            else:
                model = self.english_model
            
            if not model:
                return b"", {"error": f"No model available for language: {language}"}
            
            # Generate speech
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_file:
                tmp_file_path = tmp_file.name
            
            try:
                # Synthesize to file
                model.tts_to_file(
                    text=text,
                    file_path=tmp_file_path,
                    speaker=speaker_id,
                    speed=speed
                )
                
                # Read the audio file
                with open(tmp_file_path, "rb") as f:
                    audio_bytes = f.read()
                
                # Get audio metadata
                with wave.open(tmp_file_path, 'rb') as wav_file:
                    metadata = {
                        "sample_rate": wav_file.getframerate(),
                        "channels": wav_file.getnchannels(),
                        "duration": wav_file.getnframes() / wav_file.getframerate(),
                        "format": "wav",
                        "language": language
                    }
                
                return audio_bytes, metadata
                
            finally:
                # Clean up temporary file
                if os.path.exists(tmp_file_path):
                    os.unlink(tmp_file_path)
                    
        except Exception as e:
            logger.error(f"Error during speech synthesis: {e}")
            return b"", {"error": str(e)}
    
    def synthesize_with_phonemes(
        self,
        text: str,
        language: str = "en",
        phonemes: Optional[str] = None
    ) -> Tuple[bytes, Dict[str, Any]]:
        """
        Synthesize speech with phoneme timing information
        Useful for Live2D lip sync
        """
        if not self.models_loaded:
            return b"", {"error": "TTS models not available", "phonemes": []}
        
        try:
            # Generate speech with phoneme alignment
            audio_bytes, metadata = self.synthesize(text, language)
            
            if audio_bytes:
                # Extract phoneme timings (simplified - in production, use forced alignment)
                phoneme_data = self._estimate_phoneme_timings(text, metadata.get("duration", 0))
                metadata["phonemes"] = phoneme_data
            
            return audio_bytes, metadata
            
        except Exception as e:
            logger.error(f"Error in synthesize_with_phonemes: {e}")
            return b"", {"error": str(e), "phonemes": []}
    
    def _estimate_phoneme_timings(self, text: str, duration: float) -> list:
        """
        Estimate phoneme timings for lip sync
        This is a simplified version - in production, use proper forced alignment
        """
        # Simple estimation based on text length
        words = text.split()
        if not words:
            return []
        
        time_per_word = duration / len(words)
        phonemes = []
        current_time = 0
        
        for word in words:
            # Simple vowel detection for mouth shapes
            vowels = [c for c in word.lower() if c in "aeiou"]
            if vowels:
                for i, vowel in enumerate(vowels):
                    phonemes.append({
                        "phoneme": vowel,
                        "start": current_time + (i * time_per_word / len(vowels)),
                        "duration": time_per_word / len(vowels),
                        "mouth_shape": self._get_mouth_shape(vowel)
                    })
            current_time += time_per_word
        
        return phonemes
    
    def _get_mouth_shape(self, vowel: str) -> str:
        """Map vowels to basic mouth shapes for Live2D"""
        mouth_shapes = {
            'a': 'A',
            'e': 'E', 
            'i': 'I',
            'o': 'O',
            'u': 'U'
        }
        return mouth_shapes.get(vowel.lower(), 'N')  # N for neutral
    
    def get_available_speakers(self, language: str = "en") -> list:
        """Get available speaker IDs for the specified language"""
        if not self.models_loaded:
            return []
        
        try:
            model = self.japanese_model if language == "ja" else self.english_model
            if model and hasattr(model, 'speakers'):
                return model.speakers
            return []
        except:
            return []
    
    def get_model_info(self) -> dict:
        """Get information about loaded TTS models"""
        return {
            "models_loaded": self.models_loaded,
            "english_model": settings.tts_model_name if self.english_model else None,
            "japanese_model": settings.tts_japanese_model if self.japanese_model else None,
            "device": "cuda" if settings.tts_use_cuda else "cpu",
            "supported_languages": ["en", "ja"] if self.models_loaded else []
        }