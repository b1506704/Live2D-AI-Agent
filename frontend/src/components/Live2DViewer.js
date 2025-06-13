import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import * as PIXI from 'pixi.js';
import { Live2DModel } from 'pixi-live2d-display';
import { Box, CircularProgress, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

// Register PIXI globally for Live2D
window.PIXI = PIXI;

const ViewerContainer = styled(Box)({
  width: '100%',
  height: '100%',
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  '& canvas': {
    width: '100% !important',
    height: '100% !important',
    objectFit: 'contain',
  }
});

const LoadingContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 16,
});

const Live2DViewer = forwardRef(({ modelName, onModelLoad }, ref) => {
  const canvasRef = useRef(null);
  const appRef = useRef(null);
  const modelRef = useRef(null);
  const containerRef = useRef(null);
  const audioRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useImperativeHandle(ref, () => ({
    playAudioAnimation: (audioUrl, phonemes) => {
      playAudioWithAnimation(audioUrl, phonemes);
    },
    playMotion: (motionName) => {
      if (modelRef.current) {
        modelRef.current.motion(motionName);
      }
    },
    setExpression: (expressionName) => {
      if (modelRef.current) {
        modelRef.current.expression(expressionName);
      }
    }
  }));

  useEffect(() => {
    initializeLive2D();
    
    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (appRef.current && modelName) {
      loadModel(modelName);
    }
  }, [modelName]);

  const initializeLive2D = async () => {
    try {
      // Create PIXI application
      const app = new PIXI.Application({
        transparent: true,
        autoStart: true,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
      });

      appRef.current = app;
      
      if (containerRef.current) {
        containerRef.current.appendChild(app.view);
        
        // Handle resize
        const handleResize = () => {
          const { width, height } = containerRef.current.getBoundingClientRect();
          app.renderer.resize(width, height);
          
          if (modelRef.current) {
            // Center the model
            modelRef.current.x = width / 2;
            modelRef.current.y = height / 2;
            
            // Scale to fit
            const scale = Math.min(width / 1000, height / 1000, 1);
            modelRef.current.scale.set(scale);
          }
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        
        // Store resize handler for cleanup
        app.resizeHandler = handleResize;
      }
    } catch (err) {
      console.error('Failed to initialize Live2D:', err);
      setError('Failed to initialize Live2D viewer');
      setLoading(false);
    }
  };

  const loadModel = async (modelName) => {
    try {
      setLoading(true);
      setError(null);

      // Remove existing model
      if (modelRef.current) {
        appRef.current.stage.removeChild(modelRef.current);
        modelRef.current.destroy();
        modelRef.current = null;
      }

      // Load new model
      const modelPath = `/models/live2d/${modelName}/model.json`;
      const model = await Live2DModel.from(modelPath, {
        autoUpdate: true,
        autoInteract: true,
      });

      modelRef.current = model;
      
      // Add to stage
      appRef.current.stage.addChild(model);
      
      // Center and scale the model
      const { width, height } = containerRef.current.getBoundingClientRect();
      model.x = width / 2;
      model.y = height / 2;
      
      // Scale to fit
      const scale = Math.min(width / 1000, height / 1000, 0.8);
      model.scale.set(scale);
      
      // Set up interactions
      setupInteractions(model);
      
      // Start idle animation
      model.motion('idle');
      
      setLoading(false);
      
      if (onModelLoad) {
        onModelLoad(model);
      }
    } catch (err) {
      console.error('Failed to load Live2D model:', err);
      setError(`Failed to load model: ${modelName}`);
      setLoading(false);
    }
  };

  const setupInteractions = (model) => {
    // Mouse tracking for eyes
    appRef.current.view.addEventListener('mousemove', (event) => {
      const rect = appRef.current.view.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width * 2 - 1;
      const y = (event.clientY - rect.top) / rect.height * 2 - 1;
      
      model.focus(x, -y);
    });

    // Click interactions
    model.on('hit', (hitAreas) => {
      if (hitAreas.includes('body')) {
        model.motion('tap');
      }
    });
  };

  const playAudioWithAnimation = async (audioUrl, phonemes = []) => {
    if (!modelRef.current) return;

    // Create audio element
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    
    // Play talking animation
    modelRef.current.motion('talk');
    
    // Simple lip sync based on phonemes
    if (phonemes.length > 0) {
      startLipSync(audio, phonemes);
    } else {
      // Fallback: simple mouth movement during audio
      startSimpleLipSync(audio);
    }
    
    // Play audio
    audio.play();
    
    // Return to idle when audio ends
    audio.addEventListener('ended', () => {
      modelRef.current.motion('idle');
      stopLipSync();
    });
  };

  const startLipSync = (audio, phonemes) => {
    let currentPhonemeIndex = 0;
    
    const updateMouth = () => {
      const currentTime = audio.currentTime;
      
      // Find current phoneme
      while (
        currentPhonemeIndex < phonemes.length &&
        phonemes[currentPhonemeIndex].start < currentTime
      ) {
        const phoneme = phonemes[currentPhonemeIndex];
        
        // Set mouth shape based on phoneme
        if (modelRef.current) {
          const mouthParam = getMouthParameter(phoneme.mouth_shape);
          modelRef.current.internalModel.coreModel.setParameterValueById(
            mouthParam,
            1
          );
        }
        
        currentPhonemeIndex++;
      }
      
      if (!audio.paused && !audio.ended) {
        requestAnimationFrame(updateMouth);
      }
    };
    
    updateMouth();
  };

  const startSimpleLipSync = (audio) => {
    let animationId;
    
    const animateMouth = () => {
      if (modelRef.current && !audio.paused && !audio.ended) {
        // Simple sine wave for mouth movement
        const time = Date.now() / 100;
        const mouthOpen = (Math.sin(time) + 1) / 2;
        
        modelRef.current.internalModel.coreModel.setParameterValueById(
          'ParamMouthOpenY',
          mouthOpen * 0.8
        );
        
        animationId = requestAnimationFrame(animateMouth);
      }
    };
    
    animateMouth();
    
    audio.addEventListener('ended', () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      if (modelRef.current) {
        modelRef.current.internalModel.coreModel.setParameterValueById(
          'ParamMouthOpenY',
          0
        );
      }
    });
  };

  const stopLipSync = () => {
    if (modelRef.current) {
      modelRef.current.internalModel.coreModel.setParameterValueById(
        'ParamMouthOpenY',
        0
      );
    }
  };

  const getMouthParameter = (shape) => {
    const mouthShapeMap = {
      'A': 'ParamMouthOpenY',
      'E': 'ParamMouthForm',
      'I': 'ParamMouthForm',
      'O': 'ParamMouthOpenY',
      'U': 'ParamMouthForm',
      'N': 'ParamMouthOpenY'
    };
    
    return mouthShapeMap[shape] || 'ParamMouthOpenY';
  };

  const cleanup = () => {
    if (appRef.current) {
      if (appRef.current.resizeHandler) {
        window.removeEventListener('resize', appRef.current.resizeHandler);
      }
      
      if (modelRef.current) {
        appRef.current.stage.removeChild(modelRef.current);
        modelRef.current.destroy();
      }
      
      appRef.current.destroy(true, true);
      appRef.current = null;
    }
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  };

  return (
    <ViewerContainer ref={containerRef}>
      {loading && (
        <LoadingContainer>
          <CircularProgress />
          <Typography variant="body2" color="text.secondary">
            Loading Live2D Model...
          </Typography>
        </LoadingContainer>
      )}
      
      {error && (
        <Typography variant="body2" color="error">
          {error}
        </Typography>
      )}
    </ViewerContainer>
  );
});

Live2DViewer.displayName = 'Live2DViewer';

export default Live2DViewer;