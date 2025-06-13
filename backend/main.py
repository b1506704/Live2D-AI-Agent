import logging
from fastapi import FastAPI, HTTPException, File, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import json
import io
import os
import asyncio
from datetime import datetime

from config import settings
from ai_models import LLMManager, STTManager, TTSManager, ImageProcessor, AgentExecutor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title=settings.app_name,
    version=settings.api_version,
    description="Live2D AI Agent API with multimodal capabilities"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize AI models
logger.info("Initializing AI models...")
llm_manager = LLMManager()
stt_manager = STTManager()
tts_manager = TTSManager()
image_processor = ImageProcessor()
agent_executor = AgentExecutor(llm_manager)

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
    
    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
    
    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)
    
    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

# Request models
class ChatRequest(BaseModel):
    message: str
    language: str = "en"
    live2d_model: str = settings.default_live2d_model
    generate_audio: bool = True
    context: Optional[Dict[str, Any]] = None

class TaskRequest(BaseModel):
    task: str
    language: str = "en"
    context: Optional[Dict[str, Any]] = None
    max_iterations: Optional[int] = None

class TranscriptionRequest(BaseModel):
    language: Optional[str] = None
    task: str = "transcribe"  # "transcribe" or "translate"

# API Endpoints

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Live2D AI Agent API",
        "version": settings.api_version,
        "cuda_available": settings.cuda_available,
        "models_loaded": {
            "llm": llm_manager.model_loaded,
            "stt": stt_manager.model_loaded,
            "tts": tts_manager.models_loaded,
            "image": image_processor.models_loaded
        }
    }

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "models": {
            "llm": llm_manager.get_model_info(),
            "stt": stt_manager.get_model_info(),
            "tts": tts_manager.get_model_info(),
            "image": image_processor.get_model_info()
        }
    }

@app.get("/api/models")
async def get_live2d_models():
    """Get available Live2D models"""
    models_dir = settings.live2d_models_dir
    models = []
    
    if os.path.exists(models_dir):
        for item in os.listdir(models_dir):
            model_path = os.path.join(models_dir, item)
            if os.path.isdir(model_path):
                # Check for model.json file
                model_json = os.path.join(model_path, "model.json")
                if os.path.exists(model_json):
                    models.append({
                        "id": item,
                        "name": item,
                        "path": f"/models/live2d/{item}",
                        "default": item == settings.default_live2d_model
                    })
    
    # Add default Haru model if not present
    if not any(m["id"] == "Haru" for m in models):
        models.append({
            "id": "Haru",
            "name": "Haru (Default)",
            "path": "/models/live2d/Haru",
            "default": True
        })
    
    return {"models": models}

@app.post("/api/chat")
async def chat(request: ChatRequest):
    """Handle text chat messages"""
    try:
        # Generate text response
        response_text = llm_manager.generate_response(
            prompt=request.message,
            language=request.language,
            system_prompt=f"You are a Live2D character named {request.live2d_model}. Be friendly and engaging."
        )
        
        # Generate audio if requested
        audio_data = None
        phonemes = []
        
        if request.generate_audio:
            audio_bytes, metadata = tts_manager.synthesize_with_phonemes(
                text=response_text,
                language=request.language
            )
            
            if audio_bytes:
                audio_data = {
                    "data": audio_bytes.hex(),  # Convert to hex for JSON
                    "format": metadata.get("format", "wav"),
                    "sample_rate": metadata.get("sample_rate", 22050),
                    "duration": metadata.get("duration", 0)
                }
                phonemes = metadata.get("phonemes", [])
        
        return {
            "response": response_text,
            "audio": audio_data,
            "phonemes": phonemes,
            "language": request.language,
            "live2d_model": request.live2d_model,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error in chat endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/voice")
async def voice_input(
    audio_file: UploadFile = File(...),
    language: Optional[str] = None,
    live2d_model: str = settings.default_live2d_model
):
    """Handle voice input"""
    try:
        # Read audio data
        audio_data = await audio_file.read()
        
        # Transcribe audio
        transcription = stt_manager.transcribe(
            audio_data,
            language=language
        )
        
        if transcription.get("error"):
            raise HTTPException(status_code=400, detail=transcription["error"])
        
        # Get response using transcribed text
        chat_request = ChatRequest(
            message=transcription["text"],
            language=transcription.get("language", "en"),
            live2d_model=live2d_model,
            generate_audio=True
        )
        
        response = await chat(chat_request)
        response["transcription"] = transcription["text"]
        
        return response
        
    except Exception as e:
        logger.error(f"Error in voice endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/image")
async def image_input(
    image_file: UploadFile = File(...),
    prompt: Optional[str] = None,
    language: str = "en",
    live2d_model: str = settings.default_live2d_model
):
    """Handle image input"""
    try:
        # Read image data
        image_data = await image_file.read()
        
        # Analyze image
        analysis = image_processor.analyze_image(
            image_data,
            generate_caption=True
        )
        
        if analysis.get("error"):
            raise HTTPException(status_code=400, detail=analysis["error"])
        
        # Create prompt based on image analysis
        caption = analysis.get("caption", "an image")
        if prompt:
            full_prompt = f"The user shared an image of {caption}. They ask: {prompt}"
        else:
            full_prompt = f"The user shared an image of {caption}. Please describe what you see and provide relevant information."
        
        # Get response
        chat_request = ChatRequest(
            message=full_prompt,
            language=language,
            live2d_model=live2d_model,
            generate_audio=True,
            context={"image_analysis": analysis}
        )
        
        response = await chat(chat_request)
        response["image_analysis"] = analysis
        
        return response
        
    except Exception as e:
        logger.error(f"Error in image endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/execute-task")
async def execute_task(request: TaskRequest):
    """Execute an agentic task"""
    try:
        result = await agent_executor.execute_task(
            task=request.task,
            context=request.context,
            max_iterations=request.max_iterations,
            language=request.language
        )
        
        return {
            "task": request.task,
            "result": result,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error in execute-task endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time communication"""
    await manager.connect(websocket)
    
    try:
        while True:
            # Receive message
            data = await websocket.receive_json()
            
            message_type = data.get("type", "chat")
            
            if message_type == "chat":
                # Handle chat message
                request = ChatRequest(**data.get("data", {}))
                response = await chat(request)
                
                await manager.send_personal_message(
                    json.dumps({
                        "type": "chat_response",
                        "data": response
                    }),
                    websocket
                )
                
            elif message_type == "audio":
                # Handle audio data
                audio_data = bytes.fromhex(data.get("audio", ""))
                language = data.get("language")
                
                transcription = stt_manager.transcribe(audio_data, language)
                
                if not transcription.get("error"):
                    # Get response
                    chat_request = ChatRequest(
                        message=transcription["text"],
                        language=transcription.get("language", "en"),
                        generate_audio=True
                    )
                    response = await chat(chat_request)
                    response["transcription"] = transcription["text"]
                    
                    await manager.send_personal_message(
                        json.dumps({
                            "type": "audio_response",
                            "data": response
                        }),
                        websocket
                    )
                    
            elif message_type == "ping":
                # Handle ping
                await manager.send_personal_message(
                    json.dumps({"type": "pong"}),
                    websocket
                )
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)

@app.get("/api/languages")
async def get_supported_languages():
    """Get supported languages"""
    return {
        "languages": [
            {"code": "en", "name": "English"},
            {"code": "ja", "name": "Japanese"}
        ],
        "stt_languages": stt_manager.get_supported_languages() if stt_manager.model_loaded else [],
        "default": settings.default_language
    }

# Startup and shutdown events
@app.on_event("startup")
async def startup_event():
    """Initialize resources on startup"""
    logger.info(f"Starting {settings.app_name}...")
    logger.info(f"CUDA available: {settings.cuda_available}")
    logger.info(f"Using device: {settings.get_device()}")
    
    # Create necessary directories
    os.makedirs(settings.models_dir, exist_ok=True)
    os.makedirs(settings.live2d_models_dir, exist_ok=True)
    os.makedirs(settings.ai_models_dir, exist_ok=True)

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources on shutdown"""
    logger.info(f"Shutting down {settings.app_name}...")

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        app,
        host=settings.host,
        port=settings.port,
        log_level="info"
    )