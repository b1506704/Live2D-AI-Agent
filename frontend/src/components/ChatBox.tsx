import React, { useState, useRef, useEffect } from 'react';

interface AssetItem {
  name: string;
  url: string;
  preview?: string | null;
}

interface Message {
  sender: string;
  text?: string;
  time: string;
  type?: string;
  assets?: AssetItem[];
}

interface ChatBoxProps {
  onSend: (text: string) => void;
  messages: Message[];
  agentKey?: string;
  thinking?: boolean;
  agentName?: string;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const AGENT_AVATARS: Record<string, string> = {
  'haru_greeter_t05': '/assets/haru_pro/avatar.png',
};
const USER_AVATAR = '/assets/user/avatar.png';

const EMOTES = [
  { code: ':)', emoji: '😊' },
  { code: ':(', emoji: '😢' },
  { code: ':D', emoji: '😃' },
  { code: ';)', emoji: '😉' },
  { code: ':P', emoji: '😛' },
  { code: '<3', emoji: '❤️' },
  { code: 'xD', emoji: '😆' },
  { code: '🎉', emoji: '🎉' },
  { code: '✨', emoji: '✨' },
  { code: '💜', emoji: '💜' },
  { code: '⭐', emoji: '⭐' },
];

const ChatBox: React.FC<ChatBoxProps> = ({ onSend, messages, agentKey = 'haru_greeter_t05', thinking = false, agentName = 'Agent' }) => {
  const [input, setInput] = useState('');
  const [showEmotes, setShowEmotes] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const emotePickerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    onSend(input);
    setInput('');
    setShowEmotes(false);
  }

  function insertEmote(emoji: string) {
    const el = inputRef.current;
    if (!el) return;
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const value = el.value;
    setInput(value.substring(0, start) + emoji + value.substring(end));
    setTimeout(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + emoji.length;
    }, 0);
    setShowEmotes(false);
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (emotePickerRef.current && !emotePickerRef.current.contains(e.target as Node)) {
        setShowEmotes(false);
      }
    }
    if (showEmotes) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showEmotes]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Helper to render asset-list beautifully
  function renderAssetList(assets: AssetItem[]) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-2">
        {assets.map(asset => (
          <div key={asset.name} className="bg-white rounded-xl shadow p-4 flex flex-col items-center border border-fuchsia-100">
            {asset.preview && asset.preview.match(/\.(png|jpg|jpeg|gif|webp)$/i) && (
              <img src={asset.preview} alt={asset.name} className="w-32 h-32 object-contain mb-2 rounded-lg border" />
            )}
            {asset.preview && asset.preview.match(/\.(mp3|wav|ogg)$/i) && (
              <audio controls src={asset.preview} className="w-full mb-2" />
            )}
            <div className="font-semibold text-fuchsia-700 truncate w-full text-center" title={asset.name}>{asset.name}</div>
            <a
              href={asset.url}
              download
              className="mt-2 px-3 py-1 rounded bg-fuchsia-600 text-white hover:bg-fuchsia-700 transition text-sm font-bold shadow"
            >
              Download
            </a>
          </div>
        ))}
      </div>
    );
  }

  function ThinkingIndicator({ name }: { name: string }) {
    return (
      <div className="flex items-center gap-2 mt-2 animate-pulse text-fuchsia-600 font-semibold">
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
        <span>{name} is thinking...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-4">
        {messages.map((msg, index) => {
          const isUser = msg.sender === 'user';
          return (
            <div key={index} className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
              <div className={`flex items-end ${isUser ? 'flex-row-reverse' : ''}`}>
                <img
                  src={isUser ? USER_AVATAR : AGENT_AVATARS[agentKey]}
                  alt={isUser ? 'User Avatar' : 'Agent Avatar'}
                  className="w-10 h-10 rounded-full mr-2"
                />
                <div className="max-w-xs">
                  <div
                    className={`p-2 rounded-lg ${isUser ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-900'}`}
                  >
                    {/* Render asset-list beautifully if present */}
                    {msg.type === 'asset-list' && msg.assets ? (
                      renderAssetList(msg.assets)
                    ) : (
                      msg.text
                    )}
                  </div>
                  <div className="text-xs text-gray-500 text-right mt-1">{formatTime(new Date(msg.time))}</div>
                </div>
              </div>
            </div>
          );
        })}
        {thinking && (
          <div className="flex justify-start mb-4">
            <div className="flex items-end">
              <img
                src={AGENT_AVATARS[agentKey]}
                alt="Agent Avatar"
                className="w-10 h-10 rounded-full mr-2"
              />
              <div className="max-w-xs">
                <div className="p-2 rounded-lg bg-gray-200 text-fuchsia-700">
                  <ThinkingIndicator name={agentName} />
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      {/* Enhanced chat input area */}
      <form onSubmit={handleSend} className="sticky bottom-0 bg-white/95 p-3 border-t flex items-end z-10 shadow-inner">
        <div className="flex flex-1 items-end rounded-2xl shadow-lg border border-gray-200 bg-white px-2 py-1 focus-within:ring-2 focus-within:ring-blue-400">
          {/* Uncomment for future attachment support */}
          {/* <button type="button" className="p-2 text-gray-400 hover:text-blue-500 focus:outline-none">
            <PaperClipIcon className="w-5 h-5" />
          </button> */}
          <button
            type="button"
            onClick={() => setShowEmotes((prev) => !prev)}
            className="p-2 text-2xl text-gray-400 hover:text-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-300 rounded-full transition"
            tabIndex={-1}
          >
            {showEmotes ? '😊' : '😀'}
          </button>
          <textarea
            ref={inputRef as any}
            value={input}
            onChange={e => setInput(e.target.value)}
            rows={1}
            placeholder="Type a message..."
            className="flex-1 resize-none border-none bg-transparent outline-none px-2 py-2 text-base focus:ring-0 focus:outline-none min-h-[40px] max-h-32"
            style={{ minHeight: 40, maxHeight: 128 }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(e as any);
              }
            }}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            autoCapitalize="off"
            name="chat-message-input"
            form="off"
            data-form-autocomplete="off"
            data-lpignore="true"
          />
        </div>
        <button
          type="submit"
          className="ml-2 p-0 w-12 h-12 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-300"
          aria-label="Send message"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 20l7.293-7.293a1 1 0 011.414 0L21 20M5 19V5a2 2 0 012-2h10a2 2 0 012 2v14" />
          </svg>
        </button>
      </form>
      {showEmotes && (
        <div
          ref={emotePickerRef}
          className="absolute bottom-16 left-4 right-4 z-10 p-2 bg-white border rounded-lg shadow-lg"
        >
          <div className="grid grid-cols-8 gap-2">
            {EMOTES.map((emote) => (
              <button
                key={emote.code}
                onClick={() => insertEmote(emote.emoji)}
                className="p-2 text-xl rounded-lg hover:bg-gray-100 focus:outline-none"
                title={emote.code}
              >
                {emote.emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatBox;
