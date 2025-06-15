import React, { useState } from 'react';
import { FaSlidersH, FaUser, FaSmile, FaCheckCircle } from 'react-icons/fa';

interface OptionsTabProps {
  pitch: number;
  speed: number;
  voice: string;
  gender: string;
  mood: string;
  onSave: (opts: { pitch: number; speed: number; voice: string; gender: string; mood: string }) => void;
}

const OptionsTab: React.FC<OptionsTabProps> = ({ pitch, speed, voice, gender, mood, onSave }) => {
  const [localPitch, setLocalPitch] = useState<number>(pitch);
  const [localSpeed, setLocalSpeed] = useState<number>(speed);
  const [localVoice, setLocalVoice] = useState<string>(voice);
  const [localGender, setLocalGender] = useState<string>(gender);
  const [localMood, setLocalMood] = useState<string>(mood);
  const [showSaved, setShowSaved] = useState(false);
  const voices = [
    { value: '', label: 'Default' },
    { value: 'en-US', label: 'English (US)' },
    { value: 'en-GB', label: 'English (UK)' },
    { value: 'ja-JP', label: 'Japanese' },
    { value: 'zh-CN', label: 'Chinese' },
  ];
  const genders = [
    { value: '', label: 'Any' },
    { value: 'female', label: 'Female' },
    { value: 'male', label: 'Male' },
    { value: 'neutral', label: 'Neutral' },
  ];
  const moods = [
    { value: '', label: 'Default' },
    { value: 'happy', label: 'Happy' },
    { value: 'sad', label: 'Sad' },
    { value: 'angry', label: 'Angry' },
    { value: 'excited', label: 'Excited' },
    { value: 'calm', label: 'Calm' },
    { value: 'serious', label: 'Serious' },
  ];
  const handleSave = () => {
    onSave({
      pitch: localPitch,
      speed: localSpeed,
      voice: localVoice,
      gender: localGender,
      mood: localMood
    });
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 1800);
  };
  return (
    <div className="flex flex-col gap-6 p-4 max-w-lg mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-2">
        <FaSlidersH className="text-fuchsia-600 text-2xl" />
        <span className="text-xl font-bold text-fuchsia-700">Text-to-Speech Options</span>
      </div>
      <div className="flex flex-col gap-4 bg-white rounded-2xl shadow p-6">
        <label className="font-semibold text-fuchsia-700 mt-4">Voice</label>
        <select value={localVoice} onChange={e=>setLocalVoice(e.target.value)} className="rounded border p-2 focus:ring-2 focus:ring-fuchsia-400">
          {voices.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
        </select>
        <label className="font-semibold text-fuchsia-700 flex items-center gap-2 mt-2"><FaUser className="text-fuchsia-400" /> Gender</label>
        <select value={localGender} onChange={e=>setLocalGender(e.target.value)} className="rounded border p-2 focus:ring-2 focus:ring-fuchsia-400">
          {genders.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
        </select>
        <label className="font-semibold text-fuchsia-700 flex items-center gap-2 mt-2"><FaSmile className="text-fuchsia-400" /> Mood</label>
        <select value={localMood} onChange={e=>setLocalMood(e.target.value)} className="rounded border p-2 focus:ring-2 focus:ring-fuchsia-400">
          {moods.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <label className="font-semibold text-fuchsia-700 mt-4">Pitch</label>
        <input type="range" min="0.5" max="2" step="0.1" value={localPitch} onChange={e=>setLocalPitch(Number(e.target.value))} className="w-full" />
        <label className="font-semibold text-fuchsia-700 mt-4">Speed</label>
        <input type="range" min="0.5" max="2" step="0.1" value={localSpeed} onChange={e=>setLocalSpeed(Number(e.target.value))} className="w-full" />
        <button onClick={handleSave} className="mt-4 bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold py-2 px-6 rounded-full shadow-lg transition-all text-lg flex items-center justify-center gap-2">
          <FaCheckCircle className="mr-2" /> Save
        </button>
        {showSaved && <div className="text-green-600 text-sm mt-2 flex items-center gap-2"><FaCheckCircle /> Saved!</div>}
      </div>
    </div>
  );
};

export default OptionsTab;
