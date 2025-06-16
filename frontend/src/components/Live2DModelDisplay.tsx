import {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useState,
} from 'react';
import * as PIXI from 'pixi.js';
import { Live2DModel } from 'pixi-live2d-display-lipsyncpatch/cubism4';

export interface Live2DModelDisplayHandle {
  playTTSAndAnimate: (
    text: string,
    pitch: number,
    speed: number,
    voice?: string,
    gender?: string,
    language?: string,
    mood?: string,
    onAudioStart?: () => void,
    onAudioEnd?: () => void
  ) => Promise<void>;
  setExpression: (expressionName: string) => void;
  playMotion: (motionName: string, priority?: string) => void;
  speak: (audioUrl: string, expression?: string, onFinish?: () => void, onError?: (err: any) => void) => void;
  setParameter: (paramId: string, value: number) => void;
  getParameterValues: (paramIds: string[]) => { [key: string]: number };
  syncParameters: (paramValues: { [key: string]: number }) => void;
}

interface Live2DModelDisplayProps {
  modelPath: string;
}

const Live2DModelDisplay = forwardRef<Live2DModelDisplayHandle, Live2DModelDisplayProps>(
  ({ modelPath }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const appRef = useRef<PIXI.Application | null>(null);
    const modelRef = useRef<any>(null);
    const mouthInterval = useRef<number | null>(null);
    const audioContext = useRef<AudioContext | null>(null);
    const audioAnalyser = useRef<AnalyserNode | null>(null);
    const audioSource = useRef<MediaElementAudioSourceNode | null>(null);
    const [modelLoaded, setModelLoaded] = useState(false);
    const [isMotionPlaying, setIsMotionPlaying] = useState(false);

    useEffect(() => {
      setModelLoaded(false);
      if (!modelPath) {
        console.warn('Live2DModelDisplay: modelPath is missing or invalid:', modelPath);
        return;
      }
      if (!canvasRef.current) return;

      // Ensure parent has size before initializing PIXI
      const parent = canvasRef.current.parentElement;
      if (!parent || parent.clientWidth === 0 || parent.clientHeight === 0) {
        // Delay PIXI init until parent is sized
        requestAnimationFrame(() => setModelLoaded(false));
        return;
      }
      console.log('Live2DModelDisplay: using modelPath', modelPath);
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
      const app = new PIXI.Application({
        view: canvasRef.current!,
        width: canvasRef.current?.parentElement?.clientWidth || 400,
        height: canvasRef.current?.parentElement?.clientHeight || 600,
        backgroundAlpha: 0,
        autoStart: true,
        resizeTo: canvasRef.current?.parentElement || undefined,
      });
      app.stage.interactive = false;
      if (canvasRef.current) canvasRef.current.style.pointerEvents = 'none';
      appRef.current = app;
      function fitModelToCanvas(model: any, attempt = 0) {
        const MAX_ATTEMPTS = 20;
        const mWidth = model.width || (model.internalModel && model.internalModel.width);
        const mHeight = model.height || (model.internalModel && model.internalModel.height);

        if (
          !model ||
          typeof mWidth !== 'number' ||
          typeof mHeight !== 'number' ||
          isNaN(mWidth) ||
          isNaN(mHeight) ||
          mWidth === 0 ||
          mHeight === 0
        ) {
          if (attempt < MAX_ATTEMPTS) {
            console.warn(`fitModelToCanvas: model not ready or has invalid dimensions (attempt ${attempt + 1}/${MAX_ATTEMPTS})`, model, mWidth, mHeight);
            requestAnimationFrame(() => fitModelToCanvas(model, attempt + 1));
          } else {
            console.error('fitModelToCanvas: model still not ready after max attempts', model, mWidth, mHeight);
          }
          return;
        }
        const cWidth = app.screen.width;
        const cHeight = app.screen.height;
        const scale = Math.min(cWidth / mWidth, (cHeight / 0.45) / mHeight) * 1.25;
        model.scale.set(scale, scale);
        model.x = cWidth / 2;
        model.y = cHeight * 0.38;
        if (model.anchor && typeof model.anchor.set === 'function') {
          model.anchor.set(0.5, 0.15);
        }
      }
      async function applyPoseAndIdle(model: any) {
        const poseUrl = modelPath.replace(/\.model3\.json$/, '.pose3.json');
        try {
          const res = await fetch(poseUrl);
          if (res.ok) {
            const poseJson = await res.json();
            if (model.internalModel && model.internalModel.poseManager) {
              model.internalModel.poseManager.setup(poseJson);
              app.ticker.add(() => model.internalModel.poseManager.update(model.internalModel.coreModel, 1 / 60));
            }
          }
        } catch {}
        if (!isMotionPlaying && model.animator && model.animator.getMotionGroups) {
          const groups = model.animator.getMotionGroups();
          const idleGroup = groups.find((g: string) => g.toLowerCase().includes('idle'));
          if (idleGroup) {
            model.animator.startRandomMotion(idleGroup, 1);
          }
        }
      }
      // Always use Cubism 4 loader for .model3.json
      Live2DModel.from(modelPath)
        .then(async (model: any) => {
          console.log('Live2DModelDisplay: loaded model object:', model);
          model.interactive = false;
          modelRef.current = model;
          // Only call fitModelToCanvas and proceed if model is valid
          if (
            model &&
            (typeof model.width !== 'undefined' || (model.internalModel && typeof model.internalModel.width !== 'undefined')) &&
            (typeof model.height !== 'undefined' || (model.internalModel && typeof model.internalModel.height !== 'undefined'))
          ) {
            fitModelToCanvas(model);
            app.stage.addChild(model);
            setModelLoaded(true);
            app.renderer.on('resize', () => fitModelToCanvas(model));
            await applyPoseAndIdle(model);
          } else {
            console.error('Live2DModelDisplay: Model is invalid, missing width/height:', model);
            setModelLoaded(false);
            // Optionally, set an error state and show a message in the UI
          }
        })
        .catch((err: any) => {
          console.error('Live2DModelDisplay: error loading Live2D model:', err);
          setModelLoaded(false);
          // Optionally, set an error state and show a message in the UI
        });
      return () => {
        if (appRef.current) {
          appRef.current.destroy(true, { children: true });
          appRef.current = null;
        }
      };
    }, [modelPath]);

    useEffect(() => {
      function handlePointerMove(e: PointerEvent) {
        if (!modelLoaded || !modelRef.current || !canvasRef.current) return;
        if (isMotionPlaying) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const nx = (x - cx) / cx;
        const ny = (y - cy) / cy;
        const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
        const model = modelRef.current;
        if (model.internalModel && model.internalModel.coreModel) {
          model.internalModel.coreModel.setParameterValueById('ParamAngleX', clamp(nx * 30, -30, 30));
          model.internalModel.coreModel.setParameterValueById('ParamAngleY', clamp(-ny * 30, -30, 30));
          model.internalModel.coreModel.setParameterValueById('ParamAngleZ', clamp(nx * -10, -10, 10));
          model.internalModel.coreModel.setParameterValueById('ParamEyeBallX', clamp(nx, -1, 1));
          model.internalModel.coreModel.setParameterValueById('ParamEyeBallY', clamp(ny, -1, 1));
        }
      }
      window.addEventListener('pointermove', handlePointerMove);
      return () => {
        window.removeEventListener('pointermove', handlePointerMove);
      };
    }, [modelLoaded, isMotionPlaying]);

    useEffect(() => {
      if (!modelRef.current) return;
      const model = modelRef.current;
      const onHit = (hitAreas: string[]) => {
        if (hitAreas.includes('head')) {
          if (model.motion) model.motion('surprised');
        }
        if (hitAreas.includes('body')) {
          if (model.motion) model.motion('happy');
        }
      };
      model.on('hit', onHit);
      return () => { model.off('hit', onHit); };
    }, [modelRef.current]);

    useEffect(() => {
      if (!modelLoaded || !modelRef.current || !modelRef.current.internalModel || !modelRef.current.internalModel.coreModel) return;
      // Get the latest paramValues from props or context (if lifted)
      // For this file, we assume paramValues is managed in parent and passed via ref methods
      // We'll expose a syncParameters method on the ref
    }, [modelLoaded]);

    useImperativeHandle(ref, () => ({
      async playTTSAndAnimate(
        text,
        pitch,
        speed,
        voice,
        gender,
        language,
        mood,
        onAudioStart,
        onAudioEnd
      ) {
        if (!modelRef.current) return;
        try {
          const response = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, pitch, speed, voice, gender, language, mood }),
          });
          if (!response.ok) throw new Error('TTS failed');
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          // Use speak for advanced lipsync
          this.speak(url, mood, () => {
            if (onAudioEnd) onAudioEnd();
            // Reset to idle after speak
            if (modelRef.current && modelRef.current.motion) modelRef.current.motion('Idle');
          }, (err) => {
            if (onAudioEnd) onAudioEnd();
          });
          if (onAudioStart) onAudioStart();
        } catch (e) {
          if ('speechSynthesis' in window) {
            const utter = new window.SpeechSynthesisUtterance(text);
            utter.lang = language || 'en-US';
            utter.pitch = pitch;
            utter.rate = speed;
            utter.onstart = () => {
              if (onAudioStart) onAudioStart();
              startLipSync();
              triggerExpressiveMotion(text);
            };
            utter.onend = () => {
              if (onAudioEnd) onAudioEnd();
              stopLipSync();
              if (modelRef.current && modelRef.current.motion) modelRef.current.motion('Idle');
            };
            window.speechSynthesis.speak(utter);
          } else {
            if (onAudioStart) onAudioStart();
            startLipSync();
            triggerExpressiveMotion(text);
            setTimeout(() => {
              stopLipSync();
              if (onAudioEnd) onAudioEnd();
              if (modelRef.current && modelRef.current.motion) modelRef.current.motion('Idle');
            }, 2000);
          }
        }
      },
      setExpression(expressionName: string) {
        if (!modelRef.current) return;
        // No-op if no expressions are loaded
        if (
          modelRef.current.internalModel &&
          modelRef.current.internalModel.motionManager &&
          modelRef.current.internalModel.motionManager._expressions
        ) {
          const expressions = modelRef.current.internalModel.motionManager._expressions;
          if (expressions[expressionName]) {
            modelRef.current.expression = expressions[expressionName];
          }
        }
      },
      playMotion(motionName: string, priority = 'NORMAL') {
        if (!modelRef.current) return;
        setIsMotionPlaying(true);
        // Find the index of the motion in the default group by file name
        const motions = modelRef.current.internalModel?.motionManager?._motions?.[''] || [];
        const idx = motions.findIndex((m: any) =>
          m.file && m.file.replace(/\.motion3\.json$/, '') === motionName
        );
        if (idx !== -1) {
          modelRef.current.internalModel.motionManager.startMotion('', idx, 2);
          setTimeout(() => setIsMotionPlaying(false), 2000);
          return;
        }
        setIsMotionPlaying(false);
      },
      // Advanced lipsync with speak
      speak(audioUrl: string, expression?: string, onFinish?: () => void, onError?: (err: any) => void) {
        if (!modelRef.current) return;
        // Create audio element for lipsync
        const audio = new window.Audio(audioUrl);
        audio.crossOrigin = 'anonymous';
        // Start lipsync when audio plays
        audio.addEventListener('play', () => {
          startAudioLipSync(audio);
        });
        // Stop lipsync and call onFinish when audio ends
        audio.addEventListener('ended', () => {
          stopLipSync();
          if (onFinish) onFinish();
          if (modelRef.current && modelRef.current.motion) modelRef.current.motion('Idle');
        });
        // Stop lipsync and call onError if audio errors
        audio.addEventListener('error', (e) => {
          stopLipSync();
          if (onError) onError(e);
        });
        // Optionally set expression
        if (expression && modelRef.current.internalModel && modelRef.current.internalModel.motionManager && modelRef.current.internalModel.motionManager._expressions) {
          const expressions = modelRef.current.internalModel.motionManager._expressions;
          if (expressions[expression]) {
            modelRef.current.expression = expressions[expression];
          }
        }
        audio.play();
      },
      setParameter(paramId: string, value: number) {
        if (!modelRef.current) return;
        if (modelRef.current.internalModel && modelRef.current.internalModel.coreModel) {
          modelRef.current.internalModel.coreModel.setParameterValueById(paramId, value);
        }
      },
      getParameterValues(paramIds: string[]) {
        const result: { [key: string]: number } = {};
        if (!modelRef.current || !modelRef.current.internalModel || !modelRef.current.internalModel.coreModel) return result;
        for (const id of paramIds) {
          try {
            result[id] = modelRef.current.internalModel.coreModel.getParameterValueById(id);
          } catch {}
        }
        return result;
      },
      syncParameters(paramValues: { [key: string]: number }) {
        if (!modelRef.current || !modelRef.current.internalModel || !modelRef.current.internalModel.coreModel) return;
        for (const [paramId, value] of Object.entries(paramValues)) {
          modelRef.current.internalModel.coreModel.setParameterValueById(paramId, value);
        }
      },
    }));

    function setMouthOpenY(v: number) {
      if (!modelRef.current) return;
      v = Math.max(0, Math.min(1, v));
      modelRef.current.internalModel.coreModel.setParameterValueById('ParamMouthOpenY', v);
    }
    function startAudioLipSync(audio: HTMLAudioElement) {
      stopLipSync();
      if (!audioContext.current) audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioSource.current) audioSource.current.disconnect();
      audioSource.current = audioContext.current.createMediaElementSource(audio);
      audioAnalyser.current = audioContext.current.createAnalyser();
      audioAnalyser.current.fftSize = 2048;
      audioSource.current.connect(audioAnalyser.current);
      audioAnalyser.current.connect(audioContext.current.destination);
      const dataArray = new Uint8Array(audioAnalyser.current.fftSize);
      function animateMouth() {
        audioAnalyser.current!.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const val = (dataArray[i] - 128) / 128;
          sum += val * val;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        const amp = Math.min(1, Math.max(0, rms * 3 + 0.1));
        setMouthOpenY(amp);
        mouthInterval.current = requestAnimationFrame(animateMouth);
      }
      animateMouth();
    }
    function startLipSync() {
      stopLipSync();
      mouthInterval.current = window.setInterval(() => {
        const amp = 0.3 + 0.7 * Math.abs(Math.sin(Date.now() / 120));
        setMouthOpenY(amp);
      }, 40);
    }
    function stopLipSync() {
      if (mouthInterval.current) {
        if (typeof mouthInterval.current === 'number') clearInterval(mouthInterval.current);
        else cancelAnimationFrame(mouthInterval.current);
        mouthInterval.current = null;
      }
      setMouthOpenY(0);
    }
    function triggerExpressiveMotion(text: string) {
      if (!modelRef.current) return;
      let t = 0;
      const model = modelRef.current;
      const origY = model.y;
      const origAngleY = model.internalModel.coreModel.getParameterValueById('ParamAngleY');
      const origBrow = model.internalModel.coreModel.getParameterValueById('ParamBrowLY');
      const expressive = setInterval(() => {
        model.y = origY + Math.sin(t / 2) * 6;
        model.internalModel.coreModel.setParameterValueById('ParamAngleY', origAngleY + Math.sin(t / 3) * 10);
        model.internalModel.coreModel.setParameterValueById('ParamBrowLY', origBrow + Math.sin(t / 4) * 0.2);
        t++;
        if (t > 40) {
          model.y = origY;
          model.internalModel.coreModel.setParameterValueById('ParamAngleY', origAngleY);
          model.internalModel.coreModel.setParameterValueById('ParamBrowLY', origBrow);
          clearInterval(expressive);
        }
      }, 33);
    }

    return (
      <div
        className="w-full h-full min-w-[350px] min-h-[500px] flex items-center justify-center max-w-full max-h-full p-0 md:p-0"
        style={{ position: 'relative', width: '50vw', height: '80vh' }}
      >
        <canvas
          ref={canvasRef}
          className="block w-full h-full max-h-full max-w-full rounded-xl shadow-lg bg-transparent"
          tabIndex={0}
          aria-label="Live2D Model Canvas"
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    );
  }
);

export default Live2DModelDisplay;
