import logging
import whisper
import numpy as np
import torch
from typing import Optional, Union, BinaryIO
import tempfile
import os
from config import settings

logger = logging.getLogger(__name__)

class STTManager:
    """Manages Speech-to-Text using OpenAI Whisper"""
    
    def __init__(self):
        self.model: Optional[whisper.Whisper] = None
        self.model_loaded = False
        self._initialize_model()
    
    def _initialize_model(self):
        """Initialize the Whisper model"""
        try:
            logger.info(f"Loading Whisper model: {settings.whisper_model_size}")
            logger.info(f"Using device: {settings.whisper_device}")
            
            self.model = whisper.load_model(
                settings.whisper_model_size,
                device=settings.whisper_device
            )
            self.model_loaded = True
            
            logger.info("Whisper model loaded successfully")
            
        except Exception as e:
            logger.error(f"Failed to load Whisper model: {e}")
            self.model_loaded = False
    
    def transcribe(
        self,
        audio_data: Union[np.ndarray, bytes, BinaryIO],
        language: Optional[str] = None,
        task: str = "transcribe"
    ) -> dict:
        """
        Transcribe audio to text
        
        Args:
            audio_data: Audio data as numpy array, bytes, or file-like object
            language: Language code (e.g., 'en', 'ja'). Auto-detect if None
            task: 'transcribe' or 'translate' (to English)
            
        Returns:
            Dictionary with transcription results
        """
        if not self.model_loaded or not self.model:
            return {
                "text": "",
                "error": "STT model not available",
                "language": None
            }
        
        try:
            # Handle different input types
            if isinstance(audio_data, bytes):
                # Write bytes to temporary file
                with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_file:
                    tmp_file.write(audio_data)
                    tmp_file_path = tmp_file.name
                
                try:
                    result = self._transcribe_file(tmp_file_path, language, task)
                finally:
                    os.unlink(tmp_file_path)
                    
            elif isinstance(audio_data, np.ndarray):
                # Transcribe numpy array directly
                result = self.model.transcribe(
                    audio_data,
                    language=language,
                    task=task,
                    fp16=settings.cuda_available and settings.use_cuda
                )
                
            elif hasattr(audio_data, 'read'):
                # File-like object
                with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_file:
                    tmp_file.write(audio_data.read())
                    tmp_file_path = tmp_file.name
                
                try:
                    result = self._transcribe_file(tmp_file_path, language, task)
                finally:
                    os.unlink(tmp_file_path)
            else:
                raise ValueError(f"Unsupported audio data type: {type(audio_data)}")
            
            # Extract relevant information
            return {
                "text": result["text"].strip(),
                "language": result.get("language", language),
                "segments": result.get("segments", []),
                "error": None
            }
            
        except Exception as e:
            logger.error(f"Error during transcription: {e}")
            return {
                "text": "",
                "error": str(e),
                "language": None
            }
    
    def _transcribe_file(self, file_path: str, language: Optional[str], task: str) -> dict:
        """Transcribe audio from file"""
        return self.model.transcribe(
            file_path,
            language=language,
            task=task,
            fp16=settings.cuda_available and settings.use_cuda
        )
    
    def detect_language(self, audio_data: Union[np.ndarray, bytes]) -> Optional[str]:
        """Detect the language of the audio"""
        if not self.model_loaded or not self.model:
            return None
        
        try:
            # Use a small portion of audio for language detection
            if isinstance(audio_data, bytes):
                with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_file:
                    tmp_file.write(audio_data)
                    tmp_file_path = tmp_file.name
                
                try:
                    audio = whisper.load_audio(tmp_file_path)
                    audio = whisper.pad_or_trim(audio)
                finally:
                    os.unlink(tmp_file_path)
            else:
                audio = whisper.pad_or_trim(audio_data)
            
            # Make log-Mel spectrogram
            mel = whisper.log_mel_spectrogram(audio).to(self.model.device)
            
            # Detect language
            _, probs = self.model.detect_language(mel)
            detected_lang = max(probs, key=probs.get)
            
            logger.info(f"Detected language: {detected_lang} (confidence: {probs[detected_lang]:.2f})")
            return detected_lang
            
        except Exception as e:
            logger.error(f"Error detecting language: {e}")
            return None
    
    def get_supported_languages(self) -> list:
        """Get list of supported languages"""
        return list(whisper.tokenizer.LANGUAGES.values())
    
    def get_model_info(self) -> dict:
        """Get information about the loaded model"""
        return {
            "model_loaded": self.model_loaded,
            "model_size": settings.whisper_model_size,
            "device": settings.whisper_device,
            "supported_languages": len(self.get_supported_languages()) if self.model_loaded else 0
        }