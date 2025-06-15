import React, { useState } from 'react';

interface Motion {
  name: string;
  displayName: string;
}

interface MotionTabProps {
  motions: Motion[];
  onPlay: (motionName: string) => void;
}

const MotionTab: React.FC<MotionTabProps> = ({ motions, onPlay }) => {
  const [selected, setSelected] = useState<string>(motions[0]?.name || '');
  return (
    <div className="flex flex-col gap-6 p-4 max-w-lg mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-xl font-bold text-blue-700">Motion Player</span>
      </div>
      <div className="flex flex-col gap-4 bg-white rounded-2xl shadow p-6">
        <label className="font-semibold text-blue-700 mt-2">Select a Motion</label>
        <select
          value={selected}
          onChange={e => setSelected(e.target.value)}
          className="rounded border p-2 focus:ring-2 focus:ring-blue-400 text-lg"
        >
          {motions.map(m => (
            <option key={m.name} value={m.name}>{m.displayName}</option>
          ))}
        </select>
        <button
          onClick={() => onPlay(selected)}
          className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-full shadow-lg transition-all text-lg flex items-center justify-center gap-2"
        >
          ▶ Play Motion
        </button>
      </div>
    </div>
  );
};

export default MotionTab;
