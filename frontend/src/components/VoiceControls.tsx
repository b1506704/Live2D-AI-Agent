import React from 'react';

interface VoiceControlsProps {
  pitch: number;
  setPitch: (value: number) => void;
  speed: number;
  setSpeed: (value: number) => void;
}

const VoiceControls: React.FC<VoiceControlsProps> = ({ pitch, setPitch, speed, setSpeed }) => {
  return (
    <div className="my-5">
      <div className="mb-3">
        <label className="block font-semibold mb-1">Voice Pitch: {pitch}</label>
        <input type="range" min="0.5" max="2" step="0.1" value={pitch} onChange={e=>setPitch(Number(e.target.value))} className="w-full" />
      </div>
      <div>
        <label className="block font-semibold mb-1">Voice Speed: {speed}</label>
        <input type="range" min="0.5" max="2" step="0.1" value={speed} onChange={e=>setSpeed(Number(e.target.value))} className="w-full" />
      </div>
    </div>
  );
};

export default VoiceControls;
