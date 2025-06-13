# Live2D AI Agent Web Application

A web-based AI agent that uses Live2D models for interactive conversations. The agent supports text, voice, and image inputs, and can respond with animated Live2D characters speaking in English or Japanese.

## Features

- 🎭 **Live2D Integration**: Load and interact with Live2D Cubism models
- 💬 **Multi-modal Input**: Accept text chat, voice input, and image uploads
- 🗣️ **Voice Response**: AI responses with synchronized Live2D animations
- 🌐 **Multi-language**: Support for English and Japanese
- 🤖 **Local AI Models**: Runs completely offline with local LLM, STT, and TTS models
- 🎮 **CUDA Support**: GPU acceleration for AI inference
- 🛠️ **Agentic Capabilities**: Perform tasks and actions based on user requests

## Project Structure

```
tes-live2d/
├── frontend/           # React frontend with Live2D integration
├── backend/            # FastAPI backend with AI models
├── models/             # Directory for AI models and Live2D assets
├── docker-compose.yml  # Docker configuration for easy deployment
└── README.md          # This file
```

## Prerequisites

- Python 3.9+
- Node.js 16+
- CUDA-capable GPU (optional, for acceleration)
- Docker and Docker Compose (optional, for containerized deployment)

## Setup Instructions

### 1. Clone the repository

```bash
git clone <repository-url>
cd tes-live2d
```

### 2. Download AI Models

The application uses local AI models. Run the setup script to download them:

```bash
python scripts/download_models.py
```

This will download:
- Llama 2 7B (or similar) for LLM
- Whisper for Speech-to-Text
- Bark or Coqui TTS for Text-to-Speech
- CLIP for image understanding

### 3. Setup Live2D Models

Place your Live2D model files in `models/live2d/`. The default Haru model will be included.

### 4. Install Dependencies

#### Backend
```bash
cd backend
pip install -r requirements.txt
```

#### Frontend
```bash
cd frontend
npm install
```

### 5. Run the Application

#### Using Docker Compose (Recommended)
```bash
docker-compose up
```

#### Manual Setup
Terminal 1 (Backend):
```bash
cd backend
python main.py
```

Terminal 2 (Frontend):
```bash
cd frontend
npm start
```

## Usage

1. Open your browser and navigate to `http://localhost:3000`
2. Select a Live2D model from the dropdown (default: Haru)
3. Choose your input method:
   - **Text**: Type in the chat box
   - **Voice**: Click the microphone button and speak
   - **Image**: Upload an image for the AI to analyze
4. The AI agent will respond with:
   - Animated Live2D character
   - Synthesized speech
   - Text transcript
5. Toggle between English and Japanese using the language selector

## API Endpoints

- `POST /api/chat` - Send text messages
- `POST /api/voice` - Send audio input
- `POST /api/image` - Upload images for analysis
- `GET /api/models` - List available Live2D models
- `POST /api/execute-task` - Execute agentic tasks

## Configuration

Edit `backend/config.py` to customize:
- Model selection
- CUDA device settings
- Language preferences
- API parameters

## License

This project is licensed under the MIT License. Live2D models may have their own licensing terms.