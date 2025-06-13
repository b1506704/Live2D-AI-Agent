#!/usr/bin/env python3
"""
Script to download required AI models for the Live2D AI Agent
"""

import os
import sys
import requests
import subprocess
from pathlib import Path
from tqdm import tqdm
import hashlib

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.config import settings

def download_file(url: str, dest_path: str, expected_sha256: str = None):
    """Download a file with progress bar"""
    print(f"Downloading {os.path.basename(dest_path)}...")
    
    # Create directory if it doesn't exist
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    
    # Download with progress bar
    response = requests.get(url, stream=True)
    total_size = int(response.headers.get('content-length', 0))
    
    with open(dest_path, 'wb') as file:
        with tqdm(total=total_size, unit='iB', unit_scale=True) as pbar:
            for data in response.iter_content(chunk_size=1024):
                pbar.update(len(data))
                file.write(data)
    
    # Verify checksum if provided
    if expected_sha256:
        print("Verifying checksum...")
        sha256_hash = hashlib.sha256()
        with open(dest_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        
        if sha256_hash.hexdigest() != expected_sha256:
            os.remove(dest_path)
            raise ValueError("Checksum verification failed!")
    
    print(f"Downloaded {os.path.basename(dest_path)} successfully!")

def download_llm_model():
    """Download the LLM model (Llama 2)"""
    print("\n=== Downloading LLM Model ===")
    
    # Using a smaller model for demo purposes
    # In production, you'd download the full Llama 2 7B model
    model_url = "https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGUF/resolve/main/llama-2-7b-chat.Q4_K_M.gguf"
    model_path = os.path.join(settings.ai_models_dir, "llama-2-7b-chat.gguf")
    
    if os.path.exists(model_path):
        print(f"LLM model already exists at {model_path}")
        return
    
    # Note: This is a placeholder URL. In production, you'd need to:
    # 1. Accept the Llama 2 license on HuggingFace
    # 2. Use authenticated download or provide the actual URL
    print("Note: To download Llama 2, you need to:")
    print("1. Visit https://huggingface.co/meta-llama/Llama-2-7b-chat-hf")
    print("2. Accept the license agreement")
    print("3. Download the GGUF version from TheBloke")
    print(f"4. Place it at: {model_path}")
    
    # For demo, we'll download a smaller open model
    demo_model_url = "https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf"
    demo_model_path = os.path.join(settings.ai_models_dir, "tinyllama-1.1b-chat.gguf")
    
    if not os.path.exists(demo_model_path):
        download_file(demo_model_url, demo_model_path)
        print(f"\nDemo model downloaded. For production, replace with Llama 2 at: {model_path}")
        # Create a symlink for testing
        if not os.path.exists(model_path):
            os.symlink(demo_model_path, model_path)

def download_whisper_models():
    """Download Whisper models"""
    print("\n=== Downloading Whisper Models ===")
    
    # Whisper will auto-download on first use, but we can pre-download
    import whisper
    
    print(f"Downloading Whisper {settings.whisper_model_size} model...")
    model = whisper.load_model(settings.whisper_model_size, download_root=settings.ai_models_dir)
    print("Whisper model downloaded!")

def download_tts_models():
    """Download TTS models"""
    print("\n=== Downloading TTS Models ===")
    
    # TTS models will auto-download on first use
    print("TTS models will be downloaded automatically on first use.")
    print("Models to be downloaded:")
    print(f"- English: {settings.tts_model_name}")
    print(f"- Japanese: {settings.tts_japanese_model}")

def download_image_models():
    """Download image processing models"""
    print("\n=== Downloading Image Processing Models ===")
    
    # These will auto-download from HuggingFace on first use
    print("Image models will be downloaded automatically on first use.")
    print("Models to be downloaded:")
    print(f"- CLIP: {settings.image_model_name}")
    print("- BLIP: Salesforce/blip-image-captioning-base")

def download_live2d_sample():
    """Download sample Live2D model (Haru)"""
    print("\n=== Setting up Live2D Models ===")
    
    haru_path = os.path.join(settings.live2d_models_dir, "Haru")
    os.makedirs(haru_path, exist_ok=True)
    
    # Create a placeholder model.json for Haru
    model_json = {
        "version": "Sample",
        "model": "haru.moc3",
        "textures": ["haru.png"],
        "physics": "haru.physics3.json",
        "pose": "haru.pose3.json",
        "expressions": [
            {"name": "f01", "file": "expressions/f01.exp3.json"},
            {"name": "f02", "file": "expressions/f02.exp3.json"}
        ],
        "motions": {
            "idle": [
                {"file": "motions/haru_idle_01.motion3.json"},
                {"file": "motions/haru_idle_02.motion3.json"}
            ],
            "tap": [
                {"file": "motions/haru_tap_01.motion3.json"}
            ]
        }
    }
    
    import json
    model_json_path = os.path.join(haru_path, "model.json")
    with open(model_json_path, 'w') as f:
        json.dump(model_json, f, indent=2)
    
    print(f"Created placeholder Live2D model configuration at {haru_path}")
    print("\nNote: You need to download actual Live2D models from:")
    print("- https://www.live2d.com/download/sample-data/")
    print("- Place the model files in the models/live2d/ directory")

def main():
    """Main download function"""
    print("=== Live2D AI Agent Model Downloader ===")
    print(f"Models directory: {settings.models_dir}")
    print(f"CUDA available: {settings.cuda_available}")
    
    # Create directories
    os.makedirs(settings.models_dir, exist_ok=True)
    os.makedirs(settings.ai_models_dir, exist_ok=True)
    os.makedirs(settings.live2d_models_dir, exist_ok=True)
    
    # Download models
    try:
        download_llm_model()
        download_whisper_models()
        download_tts_models()
        download_image_models()
        download_live2d_sample()
        
        print("\n=== Download Complete ===")
        print("All models have been set up!")
        print("\nNote: Some models will download automatically on first use.")
        print("Make sure you have enough disk space (approximately 10-20 GB total).")
        
    except Exception as e:
        print(f"\nError during download: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()