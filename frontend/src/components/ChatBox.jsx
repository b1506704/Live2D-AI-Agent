import { useState, useRef, useEffect } from 'react';

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const AGENT_AVATARS = {
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

function ChatBox({ onSend, messages, agentKey = 'haru_greeter_t05' }) {
  const [input, setInput] = useState('');
  const [showEmotes, setShowEmotes] = useState(false);
  const inputRef = useRef();
  const emotePickerRef = useRef();

  function handleSend(e) {
    e.preventDefault();
    if (!input.trim()) return;
    onSend(input);
    setInput('');
    setShowEmotes(false);
  }

  function insertEmote(emoji) {
    const el = inputRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const value = el.value;
    setInput(value.substring(0, start) + emoji + value.substring(end));
    setTimeout(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + emoji.length;
    }, 0);
    setShowEmotes(false);
  }

  useEffect(() => {
    function handleClickOutside(e) {
      if (emotePickerRef.current && !emotePickerRef.current.contains(e.target)) {
        setShowEmotes(false);
      }
    }
    if (showEmotes) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showEmotes]);

  // Responsive chat area: scrollable, sticky input, avatars scale, font sizes adjust
  return (
    <div className="flex flex-col h-full max-h-[60vh] md:max-h-[70vh]">
      <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin">
        {messages.map((msg, i) => (
          <div key={i} className={`flex items-end mb-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} chat-row-anim animate-slide-in`}>
            {msg.role === 'assistant' && (
              <img src={AGENT_AVATARS[agentKey]} alt="AI" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full mr-2 ai-avatar border-2" />
            )}
            <div className={`chat-bubble px-3 py-2 rounded-2xl max-w-[80vw] sm:max-w-[60%] text-sm sm:text-base ${msg.role === 'user' ? 'user-bubble ml-2' : 'ai-bubble mr-2'}`}>{msg.content}
              <span className="block text-xs text-gray-400 mt-1 text-right">{formatTime(new Date())}</span>
            </div>
            {msg.role === 'user' && (
              <img src={USER_AVATAR} alt="You" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full ml-2 user-avatar border-2" />
            )}
          </div>
        ))}
      </div>
      <form onSubmit={handleSend} className="flex items-center gap-2 mt-2 sticky bottom-0 bg-white/80 py-2 px-1 rounded-xl shadow-inner">
        <button type="button" className="text-xl px-2" onClick={()=>setShowEmotes(v=>!v)} aria-label="Emoji picker">😊</button>
        {showEmotes && (
          <div ref={emotePickerRef} className="absolute bottom-14 left-2 z-20 bg-white border rounded-xl shadow-lg p-2 flex flex-wrap gap-1 w-56">
            {EMOTES.map(e => (
              <button key={e.code} type="button" className="text-2xl p-1 hover:bg-fuchsia-100 rounded" onClick={()=>insertEmote(e.emoji)}>{e.emoji}</button>
            ))}
          </div>
        )}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e=>setInput(e.target.value)}
          className="flex-1 rounded-full border px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-fuchsia-400"
          placeholder="Type a message..."
          autoComplete="off"
        />
        <button type="submit" className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white px-4 py-2 rounded-full font-bold transition text-xs sm:text-base">Send</button>
      </form>
    </div>
  );
}

export default ChatBox;
