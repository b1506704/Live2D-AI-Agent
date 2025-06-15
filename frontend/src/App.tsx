import React, { useState, useEffect, useRef, useCallback } from 'react';
import AssetManager from './components/AssetManager';
import Live2DModelDisplay from './components/Live2DModelDisplay';
import AgentInfo from './components/AgentInfo';
import ChatBox from './components/ChatBox';
import ErrorModal from './components/ErrorModal';
import { escapeAndEmote } from './components/utils';
import LoginPage from './components/LoginPage';
import OptionsTab from './components/OptionsTab';
import MotionTab from './components/MotionTab';

interface Message {
  sender: 'user' | 'assistant';
  text: string;
  time: string; // ISO string
}

type ChatCommand = {
  type: 'list-assets';
  directory?: string;
} | {
  type: 'delete-asset' | 'download-asset' | 'preview-asset' | 'switch-model';
  path: string;
} | {
  type: 'rename-asset';
  oldPath: string;
  newPath: string;
} | {
  type: 'show-models';
} | {
  type: 'play-audio';
  path: string;
} | {
  type: 'read-aloud';
  text: string;
} | {
  type: 'reminder';
  task: string;
  time: number;
  unit: string;
} | {
  type: 'change-expression';
  expression: string;
} | {
  type: 'animate';
  motion: string;
} | {
  type: 'set-voice-pitch' | 'set-voice-speed';
  value: number;
};

const AGENT_INFO = {
  'haru_greeter_t05': {
    name: 'Haru',
    role: 'Friendly AI Assistant',
    avatar: '/assets/haru_pro/avatar.png',
  },
};

const AGENT_GREETINGS = {
  'haru_greeter_t05': [
    "Hi there! I'm Haru, your cheerful AI assistant! 😊",
    "Hello! Haru here, ready to help and chat!",
    "Hey! I'm Haru. How can I brighten your day?",
    "Welcome! I'm Haru, your friendly AI buddy!",
    "Yo! Haru at your service! What can I do for you today?"
  ]
};

function getRandomGreeting(agentKey: string) {
  const greetings = AGENT_GREETINGS[agentKey as keyof typeof AGENT_GREETINGS];
  if (greetings && greetings.length > 0) {
    return greetings[Math.floor(Math.random() * greetings.length)];
  }
  return '';
}

const motions = [
  { name: 'haru_g_idle', displayName: 'Idle' },
  { name: 'haru_g_m01', displayName: 'Motion 01' },
  { name: 'haru_g_m02', displayName: 'Motion 02' },
  { name: 'haru_g_m03', displayName: 'Motion 03' },
  { name: 'haru_g_m04', displayName: 'Motion 04' },
  { name: 'haru_g_m05', displayName: 'Motion 05' },
  { name: 'haru_g_m06', displayName: 'Motion 06' },
  { name: 'haru_g_m07', displayName: 'Motion 07' },
  { name: 'haru_g_m08', displayName: 'Motion 08' },
  { name: 'haru_g_m09', displayName: 'Motion 09' },
  { name: 'haru_g_m10', displayName: 'Motion 10' },
  { name: 'haru_g_m11', displayName: 'Motion 11' },
  { name: 'haru_g_m12', displayName: 'Motion 12' },
  { name: 'haru_g_m13', displayName: 'Motion 13' },
  { name: 'haru_g_m14', displayName: 'Motion 14' },
  { name: 'haru_g_m15', displayName: 'Motion 15' },
  { name: 'haru_g_m16', displayName: 'Motion 16' },
  { name: 'haru_g_m17', displayName: 'Motion 17' },
  { name: 'haru_g_m18', displayName: 'Motion 18' },
  { name: 'haru_g_m19', displayName: 'Motion 19' },
  { name: 'haru_g_m20', displayName: 'Motion 20' },
  { name: 'haru_g_m21', displayName: 'Motion 21' },
  { name: 'haru_g_m22', displayName: 'Motion 22' },
  { name: 'haru_g_m23', displayName: 'Motion 23' },
  { name: 'haru_g_m24', displayName: 'Motion 24' },
  { name: 'haru_g_m25', displayName: 'Motion 25' },
  { name: 'haru_g_m26', displayName: 'Motion 26' },
];

export function App() {
  const [modelPath, setModelPath] = useState('/assets/haru_pro/haru_greeter_t05.model3.json');
  const [agentKey, setAgentKey] = useState('haru_greeter_t05');
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState('');
  const [pitch, setPitch] = useState(1.0);
  const [speed, setSpeed] = useState(1.0);
  const [activeTab, setActiveTab] = useState('chat');
  const [authenticated, setAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [responding, setResponding] = useState(false);
  const [voice, setVoice] = useState('');
  const [gender, setGender] = useState('');
  const [mood, setMood] = useState('');
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [deleteProgress, setDeleteProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    action: null | (() => void);
    message: string;
  }>({ open: false, action: null, message: '' });
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');
  const live2dRef = useRef<any>();
  const [fileUploadProgress, setFileUploadProgress] = useState<number[]>([]);
  const [fileDeleteProgress, setFileDeleteProgress] = useState<number[]>([]);
  const [fileDownloadProgress, setFileDownloadProgress] = useState<number[]>([]);
  const [assets, setAssets] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  // Helper to play TTS and manage thinking indicator
  const playTTSWithThinking = async (text: string) => {
    setResponding(true);
    if (live2dRef.current && live2dRef.current.playTTSAndAnimate) {
      await live2dRef.current.playTTSAndAnimate(
        text, pitch, speed, voice, gender, mood,
        undefined,
        () => setResponding(false)
      );
    } else {
      setResponding(false);
    }
  };

  // Show greeting on agent/model change
  useEffect(() => {
    const greeting = getRandomGreeting(agentKey);
    setMessages([
      {
        sender: 'assistant',
        text: greeting,
        time: new Date().toISOString(),
      },
    ]);
    playTTSWithThinking(greeting);
  }, [agentKey, modelPath]);

  // Check session on mount
  useEffect(() => {
    fetch('/api/assets/list', { credentials: 'include' })
      .then(r => setAuthenticated(r.status === 200));
  }, []);

  async function handleLogin(username: string, password: string) {
    setLoginError('');
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      credentials: 'include',
    });
    if (res.ok) {
      setAuthenticated(true);
    } else {
      setLoginError('Invalid username or password.');
    }
  }

  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    setAuthenticated(false);
  }

  // Helper to create a new message
  function createMessage(sender: 'user' | 'assistant', text: string): Message {
    return {
      sender,
      text,
      time: new Date().toISOString(),
    };
  }

  async function handleSendChat(input: string) {
    setMessages(msgs => [...msgs, createMessage('user', input)]);
    setResponding(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: input, model: 'Qwen3-1.7B' }),
      });
      if (!res.ok) throw new Error('Chat API error');
      const data = await res.json();
      setMessages(msgs => [...msgs, createMessage('assistant', data.response)]);
      await playTTSWithThinking(data.response);
      // Optionally refresh asset list if the command was asset-related
      if (
        input.toLowerCase().startsWith('list assets') ||
        input.toLowerCase().startsWith('delete asset') ||
        input.toLowerCase().startsWith('rename asset')
      ) {
        await fetchAssets();
      }
    } catch (e: any) {
      setError(e.message);
      setResponding(false);
    }
  }

  function handleModelChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    setModelPath(value);
    setAgentKey('haru_greeter_t05');
  }

  // Load TTS settings from backend on login or tab open
  useEffect(() => {
    if (authenticated && activeTab === 'options') {
      fetch('/api/settings/tts', { credentials: 'include' })
        .then(r => r.json())
        .then(settings => {
          if (settings.pitch !== undefined) setPitch(settings.pitch);
          if (settings.speed !== undefined) setSpeed(settings.speed);
          if (settings.voice !== undefined) setVoice(settings.voice);
          if (settings.gender !== undefined) setGender(settings.gender);
          if (settings.mood !== undefined) setMood(settings.mood);
        });
    }
  }, [authenticated, activeTab]);

  // Add save handler for Option tab
  async function handleSaveTTSOptions(newSettings: any) {
    await fetch('/api/settings/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(newSettings)
    });
    setPitch(newSettings.pitch);
    setSpeed(newSettings.speed);
    setVoice(newSettings.voice);
    setGender(newSettings.gender);
    setMood(newSettings.mood);
  }

  // Animated thinking indicator
  function ThinkingIndicator() {
    return (
      <div className="flex items-center gap-2 mt-2 animate-pulse text-fuchsia-600 font-semibold">
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
        <span>Agent is thinking...</span>
      </div>
    );
  }

  // Staging logic for persistent files
  const handleStageFiles = (files: FileList | File[]) => {
    setStagedFiles(prev => [...prev, ...Array.from(files)]);
  };
  const handleRemoveStaged = (index: number) => {
    setStagedFiles(prev => prev.filter((_, i) => i !== index));
  };
  const handleCommitUpload = async () => {
    if (!stagedFiles.length) return;
    setUploading(true);
    setUploadProgress({ current: 0, total: stagedFiles.length });
    setFileUploadProgress(Array(stagedFiles.length).fill(0));
    try {
      for (let i = 0; i < stagedFiles.length; i++) {
        const file = stagedFiles[i];
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/api/assets/upload');
          xhr.withCredentials = true;
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              setFileUploadProgress(prev => {
                const updated = [...prev];
                updated[i] = Math.round((event.loaded / event.total) * 100);
                return updated;
              });
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              setUploadProgress({ current: i + 1, total: stagedFiles.length });
              resolve();
            } else {
              reject(new Error('Upload failed for ' + file.name));
            }
          };
          xhr.onerror = () => reject(new Error('Upload failed for ' + file.name));
          const formData = new FormData();
          formData.append('file', file);
          xhr.send(formData);
        });
      }
      setStagedFiles([]);
      setUploadProgress({ current: 0, total: 0 });
      setFileUploadProgress([]);
      await fetchAssets();
    } catch (e: any) {
      // Optionally handle error
      setUploadProgress({ current: 0, total: 0 });
      setFileUploadProgress([]);
    } finally {
      setUploading(false);
    }
  };

  const showConfirm = (message: string, action: () => void) => {
    setConfirmModal({ open: true, action, message });
  };
  const hideConfirm = () => setConfirmModal({ open: false, action: null, message: '' });

  // Modified handleDelete to show progress
  const handleDelete = (assetToDelete: string | string[]) => {
    const toDelete = Array.isArray(assetToDelete) ? assetToDelete : [assetToDelete];
    showConfirm(
      `Are you sure you want to delete ${toDelete.length > 1 ? 'these files' : 'this file'}? This action cannot be undone!`,
      async () => {
        setDeleteProgress({ current: 0, total: toDelete.length });
        setFileDeleteProgress(Array(toDelete.length).fill(0));
        try {
          for (let i = 0; i < toDelete.length; i++) {
            const asset = toDelete[i];
            await fetch('/api/assets/delete', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: asset })
            });
            setDeleteProgress({ current: i + 1, total: toDelete.length });
            setFileDeleteProgress(prev => {
              const updated = [...prev];
              updated[i] = 100;
              return updated;
            });
          }
          setSelected(new Set());
          await fetchAssets();
        } catch (e: any) {
          setError(e.message || 'Delete error');
        } finally {
          setDeleteProgress({ current: 0, total: 0 });
          setFileDeleteProgress([]);
          hideConfirm();
        }
      }
    );
  };

  // Modified handleDownload to show progress
  const handleDownload = (assetToDownload: string | string[]) => {
    const toDownload = Array.isArray(assetToDownload) ? assetToDownload : [assetToDownload];
    showConfirm(
      `Download ${toDownload.length > 1 ? 'these files' : 'this file'}?`,
      async () => {
        setDownloadProgress({ current: 0, total: toDownload.length });
        setFileDownloadProgress(Array(toDownload.length).fill(0));
        for (let i = 0; i < toDownload.length; i++) {
          const asset = toDownload[i];
          window.open(`/api/assets/download?path=${encodeURIComponent(asset)}`);
          setDownloadProgress({ current: i + 1, total: toDownload.length });
          setFileDownloadProgress(prev => {
            const updated = [...prev];
            updated[i] = 100;
            return updated;
          });
          await new Promise(res => setTimeout(res, 100));
        }
        setDownloadProgress({ current: 0, total: 0 });
        setFileDownloadProgress([]);
        hideConfirm();
      }
    );
  };

  // Fetch assets from backend
  const fetchAssets = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/assets/list');
      if (!res.ok) throw new Error('Failed to fetch assets');
      const assetList = await res.json();
      setAssets(assetList);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Helper function to determine asset type
  function getAssetType(path: string): 'image' | 'audio' | 'model' | 'motion' | 'other' {
    const ext = path.toLowerCase().split('.').pop();
    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext || '')) return 'image';
    if (['wav', 'mp3', 'ogg'].includes(ext || '')) return 'audio';
    if (path.endsWith('.model3.json') || path.endsWith('.model.json')) return 'model';
    if (path.endsWith('.motion3.json')) return 'motion';
    return 'other';
  }

  if (!authenticated) {
    return <LoginPage onLogin={handleLogin} error={loginError} />;
  }

  return (
    <div className="flex flex-col md:flex-row w-full h-screen min-h-0">
      {/* Left: Live2D Model Canvas */}
      <div className="flex-1 flex items-center justify-center bg-black h-80 md:h-full min-h-0">
        <div className="w-full h-full flex items-center justify-center max-w-full max-h-full">
          <Live2DModelDisplay ref={live2dRef} modelPath={modelPath} />
        </div>
      </div>
      {/* Right: Tab menu, chat, and controls */}
      <div className="flex-1 flex flex-col h-full bg-white/90 p-0 min-h-0">
        {/* Tab menu */}
        <div className="flex border-b border-fuchsia-400 bg-gradient-to-r from-fuchsia-100/60 to-blue-100/60 rounded-none p-2 shadow text-xs sm:text-base">
          <button
            className={`tab-btn tab-button px-3 sm:px-6 py-2 font-bold rounded-full transition-all duration-200 neon-black ${activeTab === 'chat' ? 'bg-fuchsia-600 shadow ring-2 ring-fuchsia-400/40 text-white' : 'bg-white border border-fuchsia-200 hover:bg-fuchsia-50 hover:text-fuchsia-800'}`}
            onClick={() => setActiveTab('chat')}
          >
            Chat
          </button>
          <button
            className={`tab-btn tab-button px-3 sm:px-6 py-2 font-bold rounded-full transition-all duration-200 neon-black ml-2 ${activeTab === 'assets' ? 'bg-blue-600 shadow ring-2 ring-blue-400/40 text-white' : 'bg-white border border-blue-200 hover:bg-blue-50 hover:text-blue-800'}`}
            onClick={() => setActiveTab('assets')}
          >
            Asset
          </button>
          <button
            className={`tab-btn tab-button px-3 sm:px-6 py-2 font-bold rounded-full transition-all duration-200 neon-black ml-2 ${activeTab === 'options' ? 'bg-green-600 shadow ring-2 ring-green-400/40 text-white' : 'bg-white border border-green-200 hover:bg-green-50 hover:text-green-800'}`}
            onClick={() => setActiveTab('options')}
          >
            Option
          </button>
          <button
            className={`tab-btn tab-button px-3 sm:px-6 py-2 font-bold rounded-full transition-all duration-200 neon-black ml-2 ${activeTab === 'motion' ? 'bg-blue-700 shadow ring-2 ring-blue-400/40 text-white' : 'bg-white border border-blue-200 hover:bg-blue-50 hover:text-blue-800'}`}
            onClick={() => setActiveTab('motion')}
          >
            Motion
          </button>
          <button onClick={handleLogout} className="ml-auto flex items-center gap-1 px-2 sm:px-3 py-1 bg-gray-200 hover:bg-fuchsia-600 hover:text-white text-fuchsia-700 rounded-lg font-semibold transition text-xs sm:text-base">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v1" /></svg>
            Logout
          </button>
        </div>
        {/* Main content area for tab panels */}
        <div className="flex-1 flex flex-col overflow-y-auto p-2 sm:p-6 min-h-0">
          {/* Agent Info and Model Switch */}
          <div className="mb-2">
            <AgentInfo {...(AGENT_INFO[agentKey as keyof typeof AGENT_INFO] || {})} />
            <label className="block mt-2 font-semibold text-fuchsia-700">Switch Model: </label>
            <select value={modelPath} onChange={handleModelChange} className="rounded border p-1 mt-1 focus:ring-2 focus:ring-fuchsia-400 w-full max-w-xs">
              <option value="/assets/haru_pro/haru_greeter_t05.model3.json">Haru (Live2D v4)</option>
            </select>
          </div>
          {/* Tab panels */}
          {activeTab === 'chat' && (
            <>
              <ChatBox
                onSend={handleSendChat}
                messages={messages.map(m => ({
                  sender: m.sender,
                  text: escapeAndEmote(m.text),
                  time: m.time,
                }))}
                agentKey={agentKey}
              />
              {responding && <ThinkingIndicator />}
            </>
          )}
          {activeTab === 'assets' && (
            <AssetManager
              onLoadModel={path => setModelPath(path)}
              stagedFiles={stagedFiles}
              onStageFiles={handleStageFiles}
              onRemoveStaged={handleRemoveStaged}
              onCommitUpload={handleCommitUpload}
              uploading={uploading}
              uploadProgress={uploadProgress}
              fileUploadProgress={fileUploadProgress}
              deleteProgress={deleteProgress}
              fileDeleteProgress={fileDeleteProgress}
              downloadProgress={downloadProgress}
              fileDownloadProgress={fileDownloadProgress}
              confirmModal={confirmModal}
              showConfirm={showConfirm}
              hideConfirm={hideConfirm}
              renaming={renaming}
              setRenaming={setRenaming}
              renameValue={renameValue}
              setRenameValue={setRenameValue}
              handleDelete={handleDelete}
              handleDownload={handleDownload}
              assets={assets}
              selected={selected}
              setSelected={setSelected}
              refreshing={refreshing}
              fetchAssets={fetchAssets}
              error={error}
            />
          )}
          {activeTab === 'options' && (
            <OptionsTab
              pitch={pitch}
              speed={speed}
              voice={voice}
              gender={gender}
              mood={mood}
              onSave={handleSaveTTSOptions}
            />
          )}
          {activeTab === 'motion' && (
            <MotionTab
              motions={motions}
              onPlay={motionName => live2dRef.current && live2dRef.current.playMotion && live2dRef.current.playMotion(motionName)}
            />
          )}
          <ErrorModal message={error} onClose={() => setError('')} />
        </div>
      </div>
    </div>
  );
}

export default App;
