import { useState } from 'react';
import { FaVolumeUp, FaSlidersH, FaUser, FaSmile, FaCheckCircle } from 'react-icons/fa';

function OptionsTab({
  pitch, speed, voice, gender, mood,
  onSave
}) {
  const [localPitch, setLocalPitch] = useState(pitch);
  const [localSpeed, setLocalSpeed] = useState(speed);
  const [localVoice, setLocalVoice] = useState(voice);
  const [localGender, setLocalGender] = useState(gender);
  const [localMood, setLocalMood] = useState(mood);
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
        <label className="font-semibold text-fuchsia-700 mt-4">Pitch: <span className="font-normal text-gray-700">{localPitch}</span></label>
        <input type="range" min="0.5" max="2" step="0.01" value={localPitch} onChange={e=>setLocalPitch(Number(e.target.value))} className="w-full accent-fuchsia-600" />
        <label className="font-semibold text-fuchsia-700 mt-4">Speed: <span className="font-normal text-gray-700">{localSpeed}</span></label>
        <input type="range" min="0.5" max="2" step="0.01" value={localSpeed} onChange={e=>setLocalSpeed(Number(e.target.value))} className="w-full accent-fuchsia-600" />
        <button
          onClick={handleSave}
          className="mt-6 bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold py-2 px-6 rounded-full shadow-lg transition-all text-lg flex items-center justify-center gap-2"
        >
          <FaCheckCircle className="text-white text-xl" /> Save
        </button>
        {showSaved && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl px-8 py-6 flex flex-col items-center animate-fade-in border-2 border-fuchsia-400">
              <FaCheckCircle className="text-green-500 text-4xl mb-2 animate-bounce" />
              <span className="text-lg font-semibold text-fuchsia-700">Settings saved!</span>
            </div>
          </div>
        )}
      </div>
      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px);} to { opacity: 1; transform: none; } }
        .animate-fade-in { animation: fade-in 0.5s; }
      `}</style>
    </div>
  );
}

export default OptionsTab;
