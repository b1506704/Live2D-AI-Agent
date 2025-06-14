from transformers import AutoModelForCausalLM, AutoTokenizer
import os
import torch

MODEL_NAME = "Qwen/Qwen3-1.7B"
MODEL_DIR = "models/Qwen3-1.7B"

# Ensure model directory exists and download if missing
def ensure_model():
    if not os.path.exists(MODEL_DIR):
        print(f"Downloading and caching model {MODEL_NAME} ...")
        # This will download and cache the model and tokenizer
        AutoTokenizer.from_pretrained(MODEL_NAME, cache_dir=MODEL_DIR)
        AutoModelForCausalLM.from_pretrained(MODEL_NAME, cache_dir=MODEL_DIR, trust_remote_code=True)
        print("Model downloaded.")

# Load the model once at startup
ensure_model()

if not torch.cuda.is_available():
    raise RuntimeError("CUDA (GPU) is required to run this chatbot. Please ensure you have a supported GPU and CUDA installed.")
