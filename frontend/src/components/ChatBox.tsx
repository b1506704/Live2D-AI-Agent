import React, { useState, useRef, useEffect } from 'react';

interface Message {
  sender: string;
  text: string;
  time: string;
}

interface ChatBoxProps {
  onSend: (text: string) => void;
  messages: Message[];
  agentKey?: string;
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

const ChatBox: React.FC<ChatBoxProps> = ({ onSend, messages, agentKey = 'haru_greeter_t05' }) => {
  const [input, setInput] = useState('');
  const [showEmotes, setShowEmotes] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const emotePickerRef = useRef<HTMLDivElement>(null);

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
                    {msg.text}
                  </div>
                  <div className="text-xs text-gray-500 text-right mt-1">{formatTime(new Date(msg.time))}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={handleSend} className="flex p-4 border-t">
        <input
          type="text"
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Type a message..."
        />
        <button
          type="button"
          onClick={() => setShowEmotes((prev) => !prev)}
          className="ml-2 p-2 rounded-lg bg-gray-100 hover:bg-gray-200 focus:outline-none"
        >
          {showEmotes ? '😊' : '😀'}
        </button>
        <button
          type="submit"
          className="ml-2 px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 focus:outline-none"
        >
          Send
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
