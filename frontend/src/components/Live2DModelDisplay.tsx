import {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useState,
} from 'react';
import * as PIXI from 'pixi.js';

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
    const modelLoaded = useRef(false);
    const [isMotionPlaying, setIsMotionPlaying] = useState(false);

    useEffect(() => {
      modelLoaded.current = false;
      if (!modelPath) return;
      // Remove and re-create canvas to ensure clean state
      if (canvasRef.current && canvasRef.current.parentElement) {
        const oldCanvas = canvasRef.current;
        const parent = oldCanvas.parentElement;
        if (parent) {
          const newCanvas = document.createElement('canvas');
          newCanvas.className = oldCanvas.className;
          newCanvas.tabIndex = oldCanvas.tabIndex;
          newCanvas.setAttribute('aria-label', oldCanvas.getAttribute('aria-label') || '');
          parent.replaceChild(newCanvas, oldCanvas);
          canvasRef.current = newCanvas;
        }
      }
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
      const app = new PIXI.Application({
        view: canvasRef.current!,
        width: canvasRef.current?.parentElement?.clientWidth || 400,
        height: canvasRef.current?.parentElement?.clientHeight || 600,
        transparent: true,
        autoStart: true,
        backgroundAlpha: 0,
        resizeTo: canvasRef.current?.parentElement || undefined,
      });
      app.stage.interactive = false;
      if (canvasRef.current) canvasRef.current.style.pointerEvents = 'none';
      appRef.current = app;
      const isCubism4 = modelPath.endsWith('.model3.json');
      function fitModelToCanvas(model: any) {
        const cWidth = app.screen.width;
        const cHeight = app.screen.height;
        const mWidth = model.width || (model.internalModel && model.internalModel.width) || 1;
        const mHeight = model.height || (model.internalModel && model.internalModel.height) || 1;
        const scale = Math.min(cWidth / mWidth, (cHeight / 0.45) / mHeight) * 1.25;
        model.scale.set(scale, scale);
        model.x = cWidth / 2;
        model.y = cHeight * 0.38;
        model.anchor.set(0.5, 0.15);
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
      if (isCubism4) {
        // @ts-expect-error: TypeScript may not resolve this dynamic import, but it works at runtime
        import('pixi-live2d-display/cubism4').then(({ Live2DModel }) => {
          Live2DModel.from(modelPath).then(async (model: any) => {
            model.interactive = false;
            modelRef.current = model;
            fitModelToCanvas(model);
            app.stage.addChild(model);
            modelLoaded.current = true;
            app.renderer.on('resize', () => fitModelToCanvas(model));
            await applyPoseAndIdle(model);
          });
        });
      } else {
        import('pixi-live2d-display').then(({ Live2DModel }) => {
          Live2DModel.from(modelPath).then(async (model: any) => {
            model.interactive = false;
            modelRef.current = model;
            fitModelToCanvas(model);
            app.stage.addChild(model);
            modelLoaded.current = true;
            app.renderer.on('resize', () => fitModelToCanvas(model));
            await applyPoseAndIdle(model);
          });
        });
      }
      return () => {
        if (appRef.current) {
          appRef.current.destroy(true, { children: true });
          appRef.current = null;
        }
      };
    }, [modelPath]);

    useEffect(() => {
      function handlePointerMove(e: PointerEvent) {
        if (!modelLoaded.current || !modelRef.current || !canvasRef.current) return;
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
    }, [modelPath, isMotionPlaying]);

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
          const audio = new Audio(url);
          audio.onplay = () => {
            if (onAudioStart) onAudioStart();
            startAudioLipSync(audio);
            triggerExpressiveMotion(text);
          };
          audio.onended = () => {
            if (onAudioEnd) onAudioEnd();
            stopLipSync();
            URL.revokeObjectURL(url);
          };
          audio.onerror = (e) => {
            // eslint-disable-next-line no-console
            console.error('Audio playback error', e);
            alert('Audio playback error: The TTS audio could not be played.');
          };
          audio.play();
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
            };
            window.speechSynthesis.speak(utter);
          } else {
            if (onAudioStart) onAudioStart();
            startLipSync();
            triggerExpressiveMotion(text);
            setTimeout(() => {
              stopLipSync();
              if (onAudioEnd) onAudioEnd();
            }, 2000);
          }
        }
      },
      setExpression(expressionName: string) {
        if (!modelRef.current) return;
        if (
          modelRef.current.internalModel &&
          modelRef.current.internalModel.motionManager &&
          modelRef.current.internalModel.motionManager._expressions
        ) {
          const expressions = modelRef.current.internalModel.motionManager._expressions;
          if (expressions[expressionName]) {
            modelRef.current.expression = expressions[expressionName];
          }
        } else if (modelRef.current.expressions && modelRef.current.expressions[expressionName]) {
          modelRef.current.expression = modelRef.current.expressions[expressionName];
        }
      },
      playMotion(motionName: string, priority = 'NORMAL') {
        if (!modelRef.current) return;
        setIsMotionPlaying(true);
        if (typeof modelRef.current.motion === 'function') {
          modelRef.current.motion(motionName, priority);
          setTimeout(() => setIsMotionPlaying(false), 2000);
          return;
        }
        if (
          modelRef.current.internalModel &&
          modelRef.current.internalModel.motionManager &&
          modelRef.current.internalModel.motionManager._motions
        ) {
          const motions = modelRef.current.internalModel.motionManager._motions;
          for (const group in motions) {
            for (let i = 0; i < motions[group].length; i++) {
              const m = motions[group][i];
              if (
                (m.name && m.name.toLowerCase().includes(motionName.toLowerCase())) ||
                (m.file && m.file.replace(/\..+$/, '').toLowerCase().includes(motionName.toLowerCase()))
              ) {
                modelRef.current.internalModel.motionManager.startMotion(group, i, 2);
                setTimeout(() => setIsMotionPlaying(false), 2000);
                return;
              }
            }
          }
          if (motions['']) {
            for (let i = 0; i < motions[''].length; i++) {
              const m = motions[''][i];
              if (
                (m.name && m.name.toLowerCase().includes(motionName.toLowerCase())) ||
                (m.file && m.file.replace(/\..+$/, '').toLowerCase().includes(motionName.toLowerCase()))
              ) {
                modelRef.current.internalModel.motionManager.startMotion('', i, 2);
                setTimeout(() => setIsMotionPlaying(false), 2000);
                return;
              }
            }
          }
          if (motions[motionName]) {
            modelRef.current.internalModel.motionManager.startMotion(motionName, 0, 2);
            setTimeout(() => setIsMotionPlaying(false), 2000);
          }
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
