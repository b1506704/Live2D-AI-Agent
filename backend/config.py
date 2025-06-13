from pydantic_settings import BaseSettings
from typing import Optional, List
import torch
import os

class Settings(BaseSettings):
    # Server Configuration
    app_name: str = "Live2D AI Agent"
    api_version: str = "v1"
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: List[str] = ["http://localhost:3000", "http://localhost:3001"]
    
    # CUDA Configuration
    cuda_available: bool = torch.cuda.is_available()
    cuda_device: str = "cuda:0" if torch.cuda.is_available() else "cpu"
    use_cuda: bool = True  # User preference to use CUDA when available
    
    # Model Paths
    models_dir: str = "models"
    live2d_models_dir: str = "models/live2d"
    ai_models_dir: str = "models/ai"
    
    # LLM Configuration
    llm_model_name: str = "llama-2-7b-chat.gguf"
    llm_model_path: str = "models/ai/llama-2-7b-chat.gguf"
    llm_context_length: int = 4096
    llm_max_tokens: int = 512
    llm_temperature: float = 0.7
    llm_top_p: float = 0.95
    llm_threads: int = 8
    llm_gpu_layers: int = 35 if torch.cuda.is_available() else 0
    
    # Whisper Configuration (Speech-to-Text)
    whisper_model_size: str = "base"  # tiny, base, small, medium, large
    whisper_language: Optional[str] = None  # Auto-detect if None
    whisper_device: str = cuda_device if use_cuda and cuda_available else "cpu"
    
    # TTS Configuration (Text-to-Speech)
    tts_model_name: str = "tts_models/en/ljspeech/tacotron2-DDC"
    tts_vocoder_name: str = "vocoder_models/en/ljspeech/hifigan_v2"
    tts_japanese_model: str = "tts_models/ja/kokoro/tacotron2-DDC"
    tts_use_cuda: bool = use_cuda and cuda_available
    
    # Language Configuration
    default_language: str = "en"
    supported_languages: List[str] = ["en", "ja"]
    
    # Live2D Configuration
    default_live2d_model: str = "Haru"
    live2d_motion_sync: bool = True  # Sync mouth movements with audio
    
    # Agent Configuration
    agent_name: str = "AI Assistant"
    agent_personality: str = "helpful, friendly, and knowledgeable"
    enable_tool_use: bool = True
    max_agent_iterations: int = 5
    
    # Audio Configuration
    audio_sample_rate: int = 22050
    audio_channels: int = 1
    audio_format: str = "wav"
    
    # Image Processing
    image_model_name: str = "openai/clip-vit-base-patch32"
    max_image_size: tuple = (1024, 1024)
    
    # Cache Configuration
    enable_cache: bool = True
    cache_ttl: int = 3600  # 1 hour
    
    # Security
    api_key: Optional[str] = None
    enable_auth: bool = False
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        
    def get_device(self) -> str:
        """Get the appropriate device for computation"""
        if self.use_cuda and self.cuda_available:
            return self.cuda_device
        return "cpu"
    
    def get_llm_config(self) -> dict:
        """Get LLM configuration dictionary"""
        return {
            "model_path": self.llm_model_path,
            "n_ctx": self.llm_context_length,
            "n_gpu_layers": self.llm_gpu_layers if self.use_cuda and self.cuda_available else 0,
            "n_threads": self.llm_threads,
            "temperature": self.llm_temperature,
            "top_p": self.llm_top_p,
            "max_tokens": self.llm_max_tokens,
            "verbose": False
        }

settings = Settings()