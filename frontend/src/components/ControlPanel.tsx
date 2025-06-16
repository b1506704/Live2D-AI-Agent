import React, { useState, useEffect } from 'react';

interface ControlPanelProps {
  live2dRef: React.RefObject<any>;
  motions: { name: string; displayName: string }[];
  sentiment: any;
  lastAssistantMessage: string;
  paramValues: { [key: string]: number };
  setParamValues: React.Dispatch<React.SetStateAction<{ [key: string]: number }>>;
  emotionScore: number;
}

const expressions = [
  'normal', 'happy', 'sad', 'angry', 'surprised', 'smile', 'serious', 'excited', 'calm'
];

const parameters = [
  { id: 'ParamMouthOpenY', label: 'Mouth Open Y', min: 0, max: 1, step: 0.01 },
  { id: 'ParamEyeBallX', label: 'Eye Ball X', min: -1, max: 1, step: 0.01 },
  { id: 'ParamEyeBallY', label: 'Eye Ball Y', min: -1, max: 1, step: 0.01 },
  { id: 'ParamBrowLY', label: 'Brow L Y', min: -1, max: 1, step: 0.01 },
  { id: 'ParamBrowRY', label: 'Brow R Y', min: -1, max: 1, step: 0.01 },
];

const ControlPanel: React.FC<ControlPanelProps> = ({ live2dRef, motions, sentiment, lastAssistantMessage, paramValues, setParamValues, emotionScore }) => {
  // Real-time sync paramValues from the Live2D model on every frame
  useEffect(() => {
    let frameId: number;
    const syncParams = () => {
      if (!live2dRef.current || typeof live2dRef.current.getParameterValues !== 'function') {
        frameId = requestAnimationFrame(syncParams);
        return;
      }
      const paramIds = parameters.map(p => p.id);
      const newValues = live2dRef.current.getParameterValues(paramIds);
      setParamValues(v => {
        let changed = false;
        const updated = { ...v };
        for (const k in newValues) {
          if (updated[k] !== newValues[k]) {
            updated[k] = newValues[k];
            changed = true;
          }
        }
        return changed ? updated : v;
      });
      frameId = requestAnimationFrame(syncParams);
    };
    frameId = requestAnimationFrame(syncParams);
    return () => cancelAnimationFrame(frameId);
  }, [live2dRef]);

  useEffect(() => {
    if (!live2dRef.current || typeof live2dRef.current.setParameter !== 'function') return;
    // Map emotionScore to brow values: positive = raised, negative = lowered, neutral = middle
    // Clamp emotionScore to [-5, 5] for mapping
    const clamped = Math.max(-5, Math.min(5, emotionScore));
    // Map: -5 => -1 (very negative, brows down), 0 => 0 (neutral), 5 => 1 (very positive, brows up)
    const browValue = clamped / 5;
    live2dRef.current.setParameter('ParamBrowLY', browValue);
    live2dRef.current.setParameter('ParamBrowRY', browValue);
  }, [emotionScore, live2dRef]);

  const handleParamChange = (id: string, value: number) => {
    setParamValues(v => ({ ...v, [id]: value }));
    if (live2dRef.current && live2dRef.current.setParameter) {
      live2dRef.current.setParameter(id, value);
    }
  };

  // Emotion meter color
  let emotionColor = 'bg-gray-400';
  if (emotionScore > 1) emotionColor = 'bg-green-500';
  else if (emotionScore < -1) emotionColor = 'bg-blue-500';
  else emotionColor = 'bg-yellow-400';

  return (
    <div className="flex flex-col gap-6 p-4 max-w-lg mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-xl font-bold text-orange-700">Live2D Control Panel</span>
      </div>
      <div className="flex flex-col gap-4 bg-white rounded-2xl shadow p-6">
        <div className="mt-4">
          <label className="font-semibold text-orange-700">Real-time Parameter Control</label>
          <div className="flex flex-col gap-2 mt-2">
            {parameters.map(param => (
              <div key={param.id} className="flex items-center gap-2">
                <span className="w-32 text-sm">{param.label}</span>
                <input
                  type="range"
                  min={param.min}
                  max={param.max}
                  step={param.step}
                  value={paramValues[param.id] ?? 0}
                  disabled
                  className="w-full"
                />
                <span className="w-10 text-xs">{(paramValues[param.id] ?? 0).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-6">
          <label className="font-semibold text-orange-700">Emotion Meter (Sentiment)</label>
          <div className="w-full h-6 rounded-full bg-gray-200 mt-2 relative">
            <div
              className={`h-6 rounded-full transition-all duration-500 ${emotionColor}`}
              style={{ width: `${Math.min(Math.abs(emotionScore) * 20, 100)}%` }}
            />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-bold text-gray-800">
              {emotionScore > 1 ? 'Positive' : emotionScore < -1 ? 'Negative' : 'Neutral'} ({emotionScore})
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ControlPanel;