import React, { useState, useEffect, useRef } from 'react';
import { Container, Grid, Paper, Box, Typography, IconButton, Fab } from '@mui/material';
import { styled } from '@mui/material/styles';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import LanguageIcon from '@mui/icons-material/Language';
import ModelSelectIcon from '@mui/icons-material/Face';
import Live2DViewer from './components/Live2DViewer';
import ChatInterface from './components/ChatInterface';
import VoiceRecorder from './components/VoiceRecorder';
import ImageUploader from './components/ImageUploader';
import ModelSelector from './components/ModelSelector';
import LanguageSelector from './components/LanguageSelector';
import TaskExecutor from './components/TaskExecutor';
import AudioPlayer from './components/AudioPlayer';
import TranscriptPopup from './components/TranscriptPopup';
import { useAppStore } from './store/appStore';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import './App.css';

const MainContainer = styled(Container)(({ theme }) => ({
  height: '100vh',
  display: 'flex',
  flexDirection: 'column',
  padding: theme.spacing(2),
  overflow: 'hidden',
}));

const Live2DContainer = styled(Paper)(({ theme }) => ({
  height: '60vh',
  background: 'linear-gradient(135deg, #1a1f3a 0%, #0a0e27 100%)',
  borderRadius: theme.shape.borderRadius,
  overflow: 'hidden',
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

const ControlsContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  gap: theme.spacing(2),
  marginTop: theme.spacing(2),
}));

const ChatContainer = styled(Paper)(({ theme }) => ({
  height: '100%',
  background: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  overflow: 'hidden',
}));

function App() {
  const {
    selectedModel,
    language,
    isRecording,
    isProcessing,
    transcript,
    setSelectedModel,
    setLanguage,
    setIsRecording,
    setIsProcessing,
    setTranscript,
  } = useAppStore();

  const [showImageUploader, setShowImageUploader] = useState(false);
  const [showTaskExecutor, setShowTaskExecutor] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [currentAudio, setCurrentAudio] = useState(null);
  const [phonemeData, setPhonemeData] = useState([]);

  const live2dRef = useRef(null);

  useEffect(() => {
    // Initialize WebSocket connection
    const ws = new WebSocket('ws://localhost:8000/ws');
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      toast.success('Connected to AI Agent');
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      toast.error('Disconnected from AI Agent');
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      toast.error('Connection error');
    };

    return () => {
      ws.close();
    };
  }, []);

  const handleVoiceStart = () => {
    setIsRecording(true);
    toast('🎤 Recording...', { icon: '🔴' });
  };

  const handleVoiceStop = async (audioBlob) => {
    setIsRecording(false);
    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append('audio_file', audioBlob, 'recording.wav');
      formData.append('language', language);
      formData.append('live2d_model', selectedModel);

      const response = await fetch('/api/voice', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (data.transcription) {
        setTranscript(data.transcription);
      }

      if (data.audio) {
        handleAudioResponse(data.audio, data.phonemes);
      }

      toast.success('Response received!');
    } catch (error) {
      console.error('Error processing voice:', error);
      toast.error('Failed to process voice input');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAudioResponse = (audioData, phonemes) => {
    // Convert hex audio data back to blob
    const audioBytes = new Uint8Array(audioData.data.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    const audioBlob = new Blob([audioBytes], { type: 'audio/wav' });
    const audioUrl = URL.createObjectURL(audioBlob);
    
    setCurrentAudio(audioUrl);
    setPhonemeData(phonemes || []);
    
    // Trigger Live2D animation
    if (live2dRef.current) {
      live2dRef.current.playAudioAnimation(audioUrl, phonemes);
    }
  };

  const handleImageUpload = async (file, prompt) => {
    setIsProcessing(true);
    
    try {
      const formData = new FormData();
      formData.append('image_file', file);
      if (prompt) formData.append('prompt', prompt);
      formData.append('language', language);
      formData.append('live2d_model', selectedModel);

      const response = await fetch('/api/image', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (data.audio) {
        handleAudioResponse(data.audio, data.phonemes);
      }

      if (data.response) {
        setTranscript(data.response);
      }

      toast.success('Image analyzed!');
    } catch (error) {
      console.error('Error processing image:', error);
      toast.error('Failed to process image');
    } finally {
      setIsProcessing(false);
      setShowImageUploader(false);
    }
  };

  const handleTaskExecution = async (task) => {
    setIsProcessing(true);
    
    try {
      const response = await fetch('/api/execute-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task,
          language,
        }),
      });

      const data = await response.json();
      
      if (data.result && data.result.response) {
        setTranscript(data.result.response);
        toast.success('Task executed!');
      }

    } catch (error) {
      console.error('Error executing task:', error);
      toast.error('Failed to execute task');
    } finally {
      setIsProcessing(false);
      setShowTaskExecutor(false);
    }
  };

  return (
    <MainContainer maxWidth="xl">
      <Grid container spacing={2} sx={{ flexGrow: 1, height: '100%' }}>
        <Grid item xs={12} md={8}>
          <Live2DContainer elevation={3}>
            <Live2DViewer
              ref={live2dRef}
              modelName={selectedModel}
              onModelLoad={() => toast.success(`Loaded ${selectedModel} model`)}
            />
            <TranscriptPopup text={transcript} />
            
            {/* Top Controls */}
            <Box sx={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 1 }}>
              <IconButton
                color="primary"
                onClick={() => setShowModelSelector(true)}
                sx={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
              >
                <ModelSelectIcon />
              </IconButton>
              <LanguageSelector
                language={language}
                onChange={setLanguage}
              />
            </Box>
          </Live2DContainer>

          <ControlsContainer>
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <Fab
                color={isRecording ? "secondary" : "primary"}
                onClick={isRecording ? () => {} : handleVoiceStart}
                disabled={isProcessing}
                size="large"
              >
                {isRecording ? <StopIcon /> : <MicIcon />}
              </Fab>
            </motion.div>

            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <Fab
                color="primary"
                onClick={() => setShowImageUploader(true)}
                disabled={isProcessing}
              >
                <PhotoCameraIcon />
              </Fab>
            </motion.div>

            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <Fab
                color="primary"
                onClick={() => setShowTaskExecutor(true)}
                disabled={isProcessing}
              >
                <SmartToyIcon />
              </Fab>
            </motion.div>
          </ControlsContainer>
        </Grid>

        <Grid item xs={12} md={4}>
          <ChatContainer elevation={3}>
            <ChatInterface
              onAudioResponse={handleAudioResponse}
              selectedModel={selectedModel}
              language={language}
            />
          </ChatContainer>
        </Grid>
      </Grid>

      {/* Voice Recorder (Hidden) */}
      {isRecording && (
        <VoiceRecorder
          isRecording={isRecording}
          onStop={handleVoiceStop}
        />
      )}

      {/* Audio Player */}
      {currentAudio && (
        <AudioPlayer
          src={currentAudio}
          onEnded={() => setCurrentAudio(null)}
        />
      )}

      {/* Dialogs */}
      <ImageUploader
        open={showImageUploader}
        onClose={() => setShowImageUploader(false)}
        onUpload={handleImageUpload}
      />

      <TaskExecutor
        open={showTaskExecutor}
        onClose={() => setShowTaskExecutor(false)}
        onExecute={handleTaskExecution}
      />

      <ModelSelector
        open={showModelSelector}
        onClose={() => setShowModelSelector(false)}
        selectedModel={selectedModel}
        onSelectModel={(model) => {
          setSelectedModel(model);
          setShowModelSelector(false);
          toast.success(`Switched to ${model} model`);
        }}
      />
    </MainContainer>
  );
}

export default App;