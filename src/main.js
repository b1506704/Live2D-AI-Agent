import * as PIXI from 'pixi.js';
import $ from "jquery";
import { Live2DModel } from 'pixi-live2d-display/cubism4';
window.PIXI = PIXI;

let currentLive2DModelPath = "assets/haru/haru_greeter_t03.model3.json";
let model, app;
let mouthInterval, audioContext, analyser, dataArray;

// Use local static avatar images
const USER_AVATAR = '/assets/user/avatar.png';
const AGENT_AVATARS = {
  'haru_greeter_t03': '/assets/haru/avatar.png',
  'shizuku': '/assets/shizuku/avatar.png',
};

function getAgentAvatar(modelPath) {
  if (!modelPath) return '/assets/haru/avatar.png';
  const modelName = modelPath.split('/').pop().replace(/\.(model3|model)\.json$/, '');
  return AGENT_AVATARS[modelName] || '/assets/haru/avatar.png';
}

function showErrorModal(message) {
  const modal = document.getElementById('error-modal');
  const msgDiv = document.getElementById('error-modal-message');
  msgDiv.textContent = message;
  modal.classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', function() {
  const closeBtn = document.getElementById('error-modal-close');
  if (closeBtn) {
    closeBtn.onclick = function() {
      document.getElementById('error-modal').classList.add('hidden');
    };
  }
});

function getLive2DAgentName(modelPath) {
  if (!modelPath) return 'AI Agent';
  // Extract filename, remove extension, prettify
  const parts = modelPath.split('/');
  let name = parts[parts.length - 1] || '';
  name = name.replace(/\.(model3|model)\.json$/, '').replace(/_/g, ' ');
  // Capitalize first letter of each word
  name = name.replace(/\b\w/g, c => c.toUpperCase());
  return name || 'AI Agent';
}

function updateAgentNameUI() {
  const name = getLive2DAgentName(currentLive2DModelPath);
  $("#streamer-name").text(name);
}

// Live2D Agent Management
const AGENT_INFO = {
  'haru_greeter_t03': {
    name: 'Haru',
    role: 'Friendly AI Assistant',
    avatar: '/assets/haru/avatar.png',
    personality: 'cheerful and helpful'
  },
  'shizuku': {
    name: 'Shizuku',
    role: 'Knowledgeable Guide',
    avatar: '/assets/shizuku/avatar.png',
    personality: 'calm and professional'
  }
};

let currentAgent = null;

function getAgentInfo(modelPath) {
  if (!modelPath) return null;
  // Extract model name from path
  const modelName = modelPath.split('/').pop().replace(/\.(model3|model)\.json$/, '');
  return AGENT_INFO[modelName] || {
    name: modelName.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
    role: 'AI Assistant',
    avatar: '/assets/haru/avatar.png',
    personality: 'helpful'
  };
}

// Random greetings for each agent
const AGENT_GREETINGS = {
  'haru_greeter_t03': [
    "Hi there! I'm Haru, your cheerful AI assistant! 😊",
    "Hello! Haru here, ready to help and chat!",
    "Hey! I'm Haru. How can I brighten your day?",
    "Welcome! I'm Haru, your friendly AI buddy!",
    "Yo! Haru at your service! What can I do for you today?"
  ],
  'shizuku': [
    "Greetings. I'm Shizuku, your knowledgeable guide.",
    "Hello, I'm Shizuku. How may I assist you today?",
    "Welcome. Shizuku here, ready to provide information.",
    "Hi, I'm Shizuku. Ask me anything!",
    "Good day. Shizuku at your service."
  ]
};

function getRandomGreeting(modelPath) {
  if (!modelPath) return "Hello! I'm your AI assistant.";
  const modelName = modelPath.split('/').pop().replace(/\.(model3|model)\.json$/, '');
  const greetings = AGENT_GREETINGS[modelName];
  if (greetings && greetings.length > 0) {
    return greetings[Math.floor(Math.random() * greetings.length)];
  }
  // fallback generic
  return `Hello! I'm ${getLive2DAgentName(modelPath)}! How can I help you today?`;
}

function updateAgentUI(modelPath) {
  const agent = getAgentInfo(modelPath);
  currentAgent = agent;
  
  // Update UI elements
  $('#agent-name').text(agent.name);
  $('#agent-role').text(agent.role);
  $('#agent-avatar').attr('src', agent.avatar);
  $('#model-version').text(modelPath.includes('model3.json') ? 'Live2D v4' : 'Live2D v3');
  
  // Only show welcome message if chat history is empty
  if ($('#chat-history').children().length === 0) {
    setTimeout(async () => {
      showLive2DResponding(true);
      const greeting = getRandomGreeting(modelPath);
      await addChatBubble(greeting, false, true);
      await playTTSAndAnimate(greeting);
      showLive2DResponding(false);
    }, 1000);
  }
  updateLoadingText();
  updateChatPanelLayout();
  updateRespondingText();
}

// Helper function to escape HTML and handle emotes
function escapeAndEmote(text) {
  // First escape HTML
  let escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  
  // Then handle emotes (you can add more emotes here)
  const emotes = {
    ':)': '😊',
    ':(': '😢',
    ':D': '😃',
    ';)': '😉',
    ':P': '😛',
    '<3': '❤️',
    'xD': '😆'
  };
  
  Object.entries(emotes).forEach(([emote, emoji]) => {
    // Escape special characters in the emote for RegExp
    const escapedEmote = emote.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    escaped = escaped.replace(new RegExp(escapedEmote, 'g'), emoji);
  });
  
  return escaped;
}

// Enhanced version of loadLive2DModel with agent info updates
async function loadLive2DModel(modelPath) {
  let newModel = null;
  try {
    newModel = await Live2DModel.from(modelPath);
    // transforms
    newModel.x = 900;
    newModel.y = 0;
    newModel.rotation = Math.PI;
    newModel.skew.x = Math.PI;
    newModel.scale.set(0.45);
    // Remove old model only if new one loaded
    if (model) {
      app.stage.removeChild(model);
      model.destroy && model.destroy();
      model = null;
    }
    app.stage.addChild(newModel);
    model = newModel;
    updateAgentUI(modelPath);
    return true;
  } catch (e) {
    showErrorModal('Failed to load Live2D model!\n' + (e && e.message ? e.message : e));
    console.error('Live2D load error:', e);
    if (newModel) { newModel.destroy && newModel.destroy(); }
    return false;
  }
}

// --- Live2D Asset Management with backend API ---
async function fetchAssetList() {
  const res = await fetch('/api/assets/list');
  if (!res.ok) return [];
  return await res.json();
}
async function renderAssetList() {
  const ul = $('#asset-list');
  ul.empty();
  const list = await fetchAssetList();
  if (!list.length) {
    ul.append('<li class="text-gray-400">No assets found.</li>');
    return;
  }
  list.forEach((path, idx) => {
    ul.append(`<li class="flex items-center gap-2 mb-1">
      <span class="flex-1 truncate">${path}</span>
      <button class="bg-fuchsia-500 hover:bg-fuchsia-700 text-white px-2 py-1 rounded text-xs load-asset-btn" data-path="${path}">Load</button>
      <button class="bg-gray-300 hover:bg-red-400 text-gray-700 hover:text-white px-2 py-1 rounded text-xs remove-asset-btn" data-path="${path}">Remove</button>
    </li>`);
  });
}

// Initialize agent on page load
$(function() {
  // Add global dark theme styles
  $('body').css({
    'background-color': '#0f172a',
    'color': '#e2e8f0',
    'font-family': 'Inter, system-ui, -apple-system, sans-serif',
    'margin': '0',
    'padding': '0',
    'height': '100vh',
    'overflow': 'hidden'
  });

  // Style the main container
  $('.container').css({
    'display': 'flex',
    'gap': '1rem',
    'padding': '1rem',
    'height': '100vh',
    'box-sizing': 'border-box'
  });

  // Style the left column (chat)
  $('#chat-container').css({
    'flex': '1',
    'background': 'rgba(15, 23, 42, 0.7)',
    'backdrop-filter': 'blur(10px)',
    'border': '1px solid rgba(255, 255, 255, 0.1)',
    'border-radius': '1rem',
    'box-shadow': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
    'display': 'flex',
    'flex-direction': 'column',
    'height': '100%',
    'min-height': '0' // Important for flex child to respect parent height
  });

  // Style the right column (Live2D)
  $('#live2d-container').css({
    'flex': '1',
    'background': 'rgba(15, 23, 42, 0.7)',
    'backdrop-filter': 'blur(10px)',
    'border': '1px solid rgba(255, 255, 255, 0.1)',
    'border-radius': '1rem',
    'box-shadow': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
    'position': 'relative',
    'overflow': 'hidden'
  });

  // Create voice control UI
  const voiceControls = $(`
    <div class="voice-controls p-4 border-t border-gray-700">
      <div class="flex items-center gap-4">
        <div class="flex-1">
          <label class="block text-sm text-gray-400 mb-1">Voice Pitch</label>
          <input type="range" id="voice-pitch" min="0.5" max="2" step="0.1" value="1" 
            class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer">
        </div>
        <div class="flex-1">
          <label class="block text-sm text-gray-400 mb-1">Voice Speed</label>
          <input type="range" id="voice-speed" min="0.5" max="2" step="0.1" value="1"
            class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer">
        </div>
      </div>
    </div>
  `);

  // Style the chat history
  $('#chat-history').css({
    'flex': '1',
    'background': 'rgba(15, 23, 42, 0.5)',
    'backdrop-filter': 'blur(5px)',
    'border-radius': '0.75rem',
    'padding': '1rem',
    'overflow-y': 'auto',
    'margin': '1rem',
    'margin-bottom': '0',
    'min-height': '0' // Important for flex child to respect parent height
  });

  // Update chat bubbles
  $('<style>\
    .chat-bubble { \
      background: rgba(30, 41, 59, 0.7); \
      backdrop-filter: blur(5px); \
      border: 1px solid rgba(255, 255, 255, 0.1); \
      border-radius: 1rem; \
      padding: 0.75rem 1rem; \
      margin: 0.5rem 0; \
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); \
    } \
    .user-bubble { \
      background: rgba(59, 130, 246, 0.2); \
      border-color: rgba(59, 130, 246, 0.3); \
    } \
    .ai-bubble { \
      background: rgba(139, 92, 246, 0.2); \
      border-color: rgba(139, 92, 246, 0.3); \
    } \
    .welcome-bubble { \
      background: rgba(16, 185, 129, 0.2); \
      border-color: rgba(16, 185, 129, 0.3); \
    } \
    .chat-row-anim { \
      animation: slideIn 0.3s ease-out; \
    } \
    @keyframes slideIn { \
      from { opacity: 0; transform: translateY(10px); } \
      to { opacity: 1; transform: translateY(0); } \
    } \
    .user-avatar { \
      width: 32px; \
      height: 32px; \
      border-radius: 50%; \
      background: rgba(59, 130, 246, 0.2); \
      border: 2px solid rgba(59, 130, 246, 0.3); \
      display: flex; \
      align-items: center; \
      justify-content: center; \
      color: #e2e8f0; \
      font-weight: bold; \
      font-size: 1.2rem; \
    } \
    .ai-avatar { \
      width: 32px; \
      height: 32px; \
      border-radius: 50%; \
      background: rgba(139, 92, 246, 0.2); \
      border: 2px solid rgba(139, 92, 246, 0.3); \
      display: flex; \
      align-items: center; \
      justify-content: center; \
      color: #e2e8f0; \
      font-weight: bold; \
    } \
    input[type="range"] { \
      -webkit-appearance: none; \
      height: 4px; \
      background: rgba(255, 255, 255, 0.1); \
      border-radius: 2px; \
      outline: none; \
    } \
    input[type="range"]::-webkit-slider-thumb { \
      -webkit-appearance: none; \
      width: 16px; \
      height: 16px; \
      background: #3b82f6; \
      border-radius: 50%; \
      cursor: pointer; \
      border: 2px solid rgba(255, 255, 255, 0.1); \
    } \
  </style>').appendTo('head');

  // Create input container
  const inputContainer = $(`
    <div class="flex flex-col gap-2 p-4 bg-transparent border-t border-gray-700">
      <div class="flex items-center gap-2">
        <textarea id="chat-input" placeholder="Type your message here..." 
          class="flex-1 px-4 py-2 rounded-lg transition-all duration-200 ease-in-out"></textarea>
        <button id="send-button" class="px-4 py-2 rounded-lg transition-all duration-200 ease-in-out">
          Send
        </button>
      </div>
    </div>
  `);

  // Add voice controls and input container to chat container
  $('#chat-container').append(voiceControls).append(inputContainer);

  // Style the chat input
  $('#chat-input').css({
    'min-height': '40px',
    'resize': 'none',
    'outline': 'none',
    'font-size': '1rem',
    'line-height': '1.5',
    'background': 'rgba(30, 41, 59, 0.7)',
    'backdrop-filter': 'blur(5px)',
    'border': '1px solid rgba(255, 255, 255, 0.1)',
    'color': '#e2e8f0',
    'box-shadow': '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    'width': '100%'
  });

  // Style the send button
  $('#send-button').css({
    'min-width': '80px',
    'font-weight': '500',
    'display': 'flex',
    'align-items': 'center',
    'justify-content': 'center',
    'gap': '0.5rem',
    'background': 'rgba(59, 130, 246, 0.2)',
    'border': '1px solid rgba(59, 130, 246, 0.3)',
    'color': '#e2e8f0',
    'backdrop-filter': 'blur(5px)'
  });

  // Add hover effects
  $('#send-button').hover(
    function() { $(this).css('background', 'rgba(59, 130, 246, 0.3)'); },
    function() { $(this).css('background', 'rgba(59, 130, 246, 0.2)'); }
  );

  // Initialize voice settings
  let voiceSettings = {
    pitch: 1,
    speed: 1
  };

  // Update voice settings when sliders change
  $('#voice-pitch').on('input', function() {
    voiceSettings.pitch = parseFloat($(this).val());
  });

  $('#voice-speed').on('input', function() {
    voiceSettings.speed = parseFloat($(this).val());
  });

  // Initialize the greeting after a short delay to ensure everything is loaded
  setTimeout(async () => {
    try {
      const agent = getAgentInfo(currentLive2DModelPath);
      const greeting = getRandomGreeting(currentLive2DModelPath);
      
      // Wait for model initialization
      if (!window.modelInitialized) {
        console.log('Waiting for model initialization...');
        await new Promise(resolve => {
          const checkInterval = setInterval(() => {
            if (window.modelInitialized) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);
        });
      }

      // Use the local AI model for response generation and TTS
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: greeting,
            model: 'local',
            voice: true,
            pitch: voiceSettings.pitch,
            speed: voiceSettings.speed,
            stream: false // Ensure we get a complete response
          })
        });

        if (response.ok) {
          const data = await response.json();
          // Add the response to chat without the </think> tag
          const cleanResponse = data.response.replace(/<\/?think>/g, '');
          await addChatBubble(cleanResponse, false, true);
          
          // Handle TTS and animation
          if (data.audio) {
            const audioBlob = new Blob([data.audio], { type: 'audio/wav' });
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            
            // Start the audio
            audio.play();
            
            // Trigger Live2D animation when audio starts
            audio.onplay = () => {
              if (model) {
                model.internalModel.motionManager.startRandomMotion('Idle');
              }
            };
            
            // Clean up when audio ends
            audio.onended = () => {
              URL.revokeObjectURL(audioUrl);
              if (model) {
                model.internalModel.motionManager.startRandomMotion('Idle');
              }
            };
          }
        } else {
          console.error('Failed to get response from local AI model');
          // Fallback to simple greeting if AI model fails
          await addChatBubble(greeting, false, true);
        }
      } catch (error) {
        console.error('Error with local AI model:', error);
        // Fallback to simple greeting if AI model fails
        await addChatBubble(greeting, false, true);
      }
    } catch (error) {
      console.error('Error during greeting:', error);
    }
  }, 2000);

  // Remove transcription element if it exists
  // $('#transcription').remove();

  updateAgentUI(currentLive2DModelPath);
});

// Enhanced chat bubble with agent personality and avatars
async function addChatBubble(text, isUser, isWelcome = false) {
  // Remove </think> tags from text
  text = text.replace(/<\/?think>/g, '');
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  let user, badge, avatarUrl, avatar;
  if (isUser) {
    user = { name: 'You', color: '#22d3ee', badge: 'User' };
    avatarUrl = USER_AVATAR;
    avatar = `<img src="${avatarUrl}" class="user-avatar w-8 h-8 rounded-full border-2 border-cyan-300"/>`;
  } else {
    const agent = currentAgent || getAgentInfo(currentLive2DModelPath);
    user = { name: agent.name, color: '#a855f7', badge: 'AI Agent' };
    avatarUrl = getAgentAvatar(currentLive2DModelPath);
    avatar = `<img src="${avatarUrl}" class="ai-avatar w-8 h-8 rounded-full border-2 border-fuchsia-400"/>`;
  }
  badge = user.badge ? `<span class='ml-1 bg-gradient-to-r from-fuchsia-400 to-blue-400 text-white text-xs px-2 py-0.5 rounded-full align-middle'>${user.badge}</span>` : '';
  const bubbleClass = isWelcome ? 'welcome-bubble' : (isUser ? 'user-bubble' : 'ai-bubble');
  const bubble = $(`
    <div class='flex items-start gap-2 ${isUser ? 'justify-end' : ''}'>
      ${!isUser ? `
        <div class="relative">
          ${avatar}
          ${isWelcome ? '<div class="absolute -bottom-1 -right-1 bg-green-400 w-2 h-2 rounded-full border border-white animate-pulse"></div>' : ''}
        </div>
      ` : ''}
      <div class='flex-1 ${isUser ? 'text-right' : ''}'>
        <div class='flex items-center gap-1 mb-1 ${isUser ? 'justify-end' : ''}'>
          <span class='font-bold' style='color:${user.color}'>${user.name}</span>${badge}
          <span class='text-xs text-gray-400 ml-2'>${time}</span>
        </div>
        <div class='chat-bubble ${bubbleClass} ${isWelcome ? 'bg-gradient-to-r from-fuchsia-500/10 to-blue-500/10' : ''}'>${escapeAndEmote(text)}</div>
      </div>
      ${isUser ? `
        <div class="relative">
          ${avatar}
        </div>
      ` : ''}
    </div>
  `);
  $('#chat-history').append(bubble);
  bubble.hide().fadeIn(400).addClass('animate-slide-in');
  $('#chat-history').scrollTop($('#chat-history')[0].scrollHeight);
  // Add typing animation for AI messages
  if (!isUser) {
    const bubbleContent = bubble.find('.chat-bubble');
    const originalText = bubbleContent.html();
    bubbleContent.html('');
    // Simulate typing effect
    const words = originalText.split(' ');
    for (let i = 0; i < words.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 50));
      bubbleContent.html(originalText.split(' ').slice(0, i + 1).join(' '));
    }
  }
}

// Add CSS for welcome message
$('<style>\
.welcome-bubble { border: 1px solid rgba(167, 139, 250, 0.1); }\
</style>').appendTo('head');

$(async function() {
  app = new PIXI.Application({
    view: document.getElementById("canvas2"),
    autoStart: true,
  });
  await loadLive2DModel(currentLive2DModelPath);

  // 设置嘴型
  const setMouthOpenY = v=>{
    v = Math.max(0,Math.min(1,v));
    model.internalModel.coreModel.setParameterValueById('ParamMouthOpenY',v);
  }

  // --- Enhanced idle animation ---
  let idleInterval = null;
  function startIdleAnimation() {
    if (idleInterval) clearInterval(idleInterval);
    idleInterval = setInterval(() => {
      // Subtle breathing (ParamBodyAngleX), blinking (ParamEyeLOpen), head tilt (ParamAngleZ)
      const t = Date.now() / 1000;
      const breath = 5 * Math.sin(t * 0.7);
      const headTilt = 5 * Math.sin(t * 0.5 + 1);
      const blink = 1 - Math.abs(Math.sin(t * 2.2));
      model.internalModel.coreModel.setParameterValueById('ParamBodyAngleX', breath);
      model.internalModel.coreModel.setParameterValueById('ParamAngleZ', headTilt);
      model.internalModel.coreModel.setParameterValueById('ParamEyeLOpen', blink);
      model.internalModel.coreModel.setParameterValueById('ParamEyeROpen', blink);
    }, 33);
  }
  function stopIdleAnimation() {
    if (idleInterval) clearInterval(idleInterval);
    idleInterval = null;
  }

  // --- Enhanced Lip sync and hand/body/face animation ---
  let mouthInterval = null;
  let audioAnalyser = null, audioSource = null, audioContext = null;
  async function playTTSAndAnimate(text) {
    const pitch = parseFloat($('#pitch-slider').val());
    const speed = parseFloat($('#speed-slider').val());
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, pitch, speed })
      });
      if (!response.ok) throw new Error('TTS failed');
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const err = await response.json();
        throw new Error(err.error || 'TTS failed');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onplay = () => { startAudioLipSync(audio); triggerExpressiveMotion(text); stopIdleAnimation(); };
      audio.onended = () => { stopLipSync(); startIdleAnimation(); URL.revokeObjectURL(url); };
      audio.play();
    } catch (e) {
      // fallback: browser TTS
      if ('speechSynthesis' in window) {
        const utter = new window.SpeechSynthesisUtterance(text);
        utter.lang = 'en-US';
        utter.pitch = pitch;
        utter.rate = speed;
        utter.onstart = () => { startLipSync(); triggerExpressiveMotion(text); stopIdleAnimation(); };
        utter.onend = () => { stopLipSync(); startIdleAnimation(); };
        window.speechSynthesis.speak(utter);
      } else {
        startLipSync(); triggerExpressiveMotion(text); setTimeout(() => { stopLipSync(); startIdleAnimation(); }, 2000);
      }
    }
  }
  function startAudioLipSync(audio) {
    stopLipSync();
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioSource) audioSource.disconnect();
    audioSource = audioContext.createMediaElementSource(audio);
    audioAnalyser = audioContext.createAnalyser();
    audioAnalyser.fftSize = 2048;
    audioSource.connect(audioAnalyser);
    audioAnalyser.connect(audioContext.destination);
    const dataArray = new Uint8Array(audioAnalyser.fftSize);
    function animateMouth() {
      audioAnalyser.getByteTimeDomainData(dataArray);
      // Calculate amplitude (volume)
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const val = (dataArray[i] - 128) / 128;
        sum += val * val;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      // Map RMS to mouth open (tweak for realism)
      const amp = Math.min(1, Math.max(0, rms * 3 + 0.1));
      setMouthOpenY(amp);
      mouthInterval = requestAnimationFrame(animateMouth);
    }
    animateMouth();
  }
  function startLipSync() {
    stopLipSync();
    mouthInterval = setInterval(() => {
      // Simulate mouth open/close with random amplitude (fallback)
      const amp = 0.3 + 0.7 * Math.abs(Math.sin(Date.now()/120));
      setMouthOpenY(amp);
    }, 40);
  }
  function stopLipSync() {
    if (mouthInterval) {
      if (typeof mouthInterval === 'number') clearInterval(mouthInterval);
      else cancelAnimationFrame(mouthInterval);
      mouthInterval = null;
    }
    setMouthOpenY(0);
  }

  // --- Expressive body/face motion during speech ---
  function triggerExpressiveMotion(text) {
    // --- Detect message type/intent (English & Chinese) ---
    let intent = 'neutral';
    const lower = text.toLowerCase();
    // Greeting
    if (/\b(hello|hi|hey|greetings|good (morning|afternoon|evening))\b|你好|您好|哈喽|早上好|下午好|晚上好/.test(lower)) intent = 'greeting';
    // Thanks
    else if (/\b(thank(s| you)|appreciate|grateful)\b|谢谢|多谢|感谢|辛苦了|感激/.test(lower)) intent = 'thanks';
    // Apology
    else if (/\b(sorry|apolog(y|ize)|my bad)\b|对不起|抱歉|不好意思|请原谅/.test(lower)) intent = 'apology';
    // Affirmation
    else if (/\b(yes|sure|of course|definitely|absolutely)\b|是的|没错|当然|好的|行|可以|对/.test(lower)) intent = 'affirm';
    // Negation
    else if (/\b(no|not really|nah|never|nope)\b|不是|不行|没|没有|不对|不可以|否/.test(lower)) intent = 'negate';
    // Exclamation
    else if (/[!?]$/.test(lower) || /\b(wow|amazing|awesome|incredible|unbelievable)\b|哇|厉害|太棒了|牛|不可思议|惊人|棒/.test(lower)) intent = 'exclaim';
    // Question
    else if (/\b(what|why|how|when|where|who|\?)\b|吗|呢|？|怎么|为何|为什么|多少|谁|哪|啥/.test(lower)) intent = 'question';

    // --- Map intent to Live2D motion group if available ---
    let group = null;
    if (model && model.motionManager && model.motionManager._motions) {
      const groups = Object.keys(model.motionManager._motions);
      const intentToGroup = {
        greeting: ['greet', 'greeting', 'hello', 'wave'],
        thanks: ['thanks', 'bow', 'happy'],
        apology: ['apology', 'bow', 'sad'],
        affirm: ['yes', 'nod', 'happy'],
        negate: ['no', 'shake', 'angry'],
        exclaim: ['excited', 'jump', 'surprised'],
        question: ['question', 'think', 'confused'],
        neutral: ['idle', 'talk']
      };
      // Try to find a matching group for the detected intent
      for (const g of intentToGroup[intent] || []) {
        if (groups.some(x => x.toLowerCase().includes(g))) {
          group = groups.find(x => x.toLowerCase().includes(g));
          break;
        }
      }
      // If found, play a random motion from that group
      if (group) {
        const motions = model.motionManager._motions[group];
        const idx = Math.floor(Math.random() * motions.length);
        model.motionManager.startMotion(group, idx, 2);
      } else if (groups.length > 0) {
        // Fallback: random group
        const fallbackGroup = groups[Math.floor(Math.random() * groups.length)];
        const motions = model.motionManager._motions[fallbackGroup];
        const idx = Math.floor(Math.random() * motions.length);
        model.motionManager.startMotion(fallbackGroup, idx, 2);
      }
    }
    // Layered face/body expressiveness (as before)
    let t = 0;
    const origY = model.y;
    const origAngleY = model.internalModel.coreModel.getParameterValueById('ParamAngleY');
    const origBrow = model.internalModel.coreModel.getParameterValueById('ParamBrowLY');
    const expressive = setInterval(() => {
      // Sway head and body, raise/lower brow, slight y movement
      model.y = origY + Math.sin(t/2)*6;
      model.internalModel.coreModel.setParameterValueById('ParamAngleY', origAngleY + Math.sin(t/3)*10);
      model.internalModel.coreModel.setParameterValueById('ParamBrowLY', origBrow + Math.sin(t/4)*0.2);
      t++;
      if (t > 40) {
        model.y = origY;
        model.internalModel.coreModel.setParameterValueById('ParamAngleY', origAngleY);
        model.internalModel.coreModel.setParameterValueById('ParamBrowLY', origBrow);
        clearInterval(expressive);
      }
    }, 33);
  }

  // Start idle animation on load
  startIdleAnimation();

  // --- UI logic ---
  // Change Live2D model
  $('#live2d-model-select').on('change', async function() {
    const relPath = $(this).val();
    const newPath = 'assets/' + relPath.split('assets/')[1];
    const success = await loadLive2DModel(newPath);
    if (success) {
      currentLive2DModelPath = newPath;
    }
  });
  // Upload Live2D model
  $('#live2d-upload').off('change').on('change', async function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    await fetch('/api/assets/upload', {
      method: 'POST',
      body: formData
    });
    renderAssetList();
  });
  // Send chat
  $('#send-btn').on('click', function() {
    sendChat();
  });
  $('#chat-input').on('keypress', function(e) {
    if (e.which === 13) sendChat();
  });
  function sendChat() {
    const prompt = $('#chat-input').val();
    const modelKey = $('#chat-model-select').val();
    if (!prompt) return;
    $('#send-btn').prop('disabled', true);
    addChatBubble(prompt, true);
    showLive2DResponding(true);
    $.ajax({
      url: '/api/chat',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ prompt, model: modelKey }),
      success: function(data) {
        const cleanResponse = data.response.replace(/<\/?think>/g, '');
        addChatBubble(cleanResponse, false);
        // showResponsePopup(cleanResponse);
        playTTSAndAnimate(cleanResponse);
      },
      complete: function() {
        $('#send-btn').prop('disabled', false);
        $('#chat-input').val('');
        showLive2DResponding(false);
      }
    });
  }
  // Helper: random username and color for demo
  function getRandomUser() {
    const users = [
      { name: 'You', color: '#22d3ee', badge: 'VIP' },
      { name: 'Haru', color: '#a855f7', badge: 'Haru' }
    ];
    return users[Math.floor(Math.random() * users.length)];
  }

  // --- Voice pitch and speed controls ---
  $('#pitch-slider').on('input', function() {
    $('#pitch-value').text(parseFloat(this.value).toFixed(2));
  });
  $('#speed-slider').on('input', function() {
    $('#speed-value').text(parseFloat(this.value).toFixed(2));
  });

  // --- Twitch-style overlay notification and event logic ---
  function animateCounter(id, to) {
    const el = $(id);
    const from = parseInt(el.text().replace(/,/g, '')) || 0;
    const diff = to - from;
    if (diff === 0) return;
    const steps = 20;
    let current = from;
    let step = 0;
    const interval = setInterval(() => {
      current += Math.round(diff / steps);
      if ((diff > 0 && current >= to) || (diff < 0 && current <= to) || step >= steps) {
        el.text(to.toLocaleString());
        clearInterval(interval);
      } else {
        el.text(current.toLocaleString());
      }
      step++;
    }, 30);
  }
  function showOverlayNotification(msg, color = 'bg-fuchsia-600') {
    const overlay = $('#overlay-notification');
    overlay.text(msg).removeClass('hidden').removeClass().addClass(`absolute left-1/2 top-8 transform -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-lg text-lg font-bold animate-bounce ${color}`);
    setTimeout(() => overlay.addClass('hidden'), 2500);
  }
  function showConfetti() {
    // Simple confetti effect using emoji
    const confetti = $('<div class="fixed inset-0 pointer-events-none z-50 flex justify-center items-start"></div>');
    for (let i = 0; i < 30; i++) {
      const emoji = ["🎉", "✨", "💜", "⭐", "🎊"][Math.floor(Math.random()*5)];
      const span = $(`<span style="font-size:${24+Math.random()*24}px; position:absolute; left:${Math.random()*100}vw; top:-40px;">${emoji}</span>`);
      confetti.append(span);
      span.animate({ top: `${60+Math.random()*30}vh`, opacity: 0.7 }, 1800+Math.random()*800, 'swing', function() { span.remove(); });
    }
    $('body').append(confetti);
    setTimeout(() => confetti.remove(), 2500);
  }
  // Simulate random follower/subscriber events
  setInterval(() => {
    if (Math.random() < 0.15) {
      // 15% chance every 10s
      const followers = parseInt($('#follower-count').text().replace(/,/g, '')) + 1;
      animateCounter('#follower-count', followers);
      showOverlayNotification('New Follower! 🎉', 'bg-yellow-500');
      $('#recent-event').text(`Latest follower joined!`);
    } else if (Math.random() < 0.10) {
      // 10% chance every 10s
      const subs = parseInt($('#subscriber-count').text()) + 1;
      animateCounter('#subscriber-count', subs);
      showOverlayNotification('New Subscriber! 💜', 'bg-pink-500');
      $('#recent-event').text(`New subscriber! Thank you!`);
      showConfetti();
    }
  }, 10000);

  // --- Tab menu logic ---
  $(function() {
    $('#tab-chat').on('click', function() {
      $('#tab-chat').addClass('text-fuchsia-700 border-b-2 border-fuchsia-600 bg-white').removeClass('text-gray-600');
      $('#tab-assets').removeClass('text-fuchsia-700 border-b-2 border-fuchsia-600 bg-white').addClass('text-gray-600');
      $('#tab-panel-chat').removeClass('hidden');
      $('#tab-panel-assets').addClass('hidden');
      layoutInputAndVoiceControls();
    });
    $('#tab-assets').on('click', function() {
      $('#tab-assets').addClass('text-fuchsia-700 border-b-2 border-fuchsia-600 bg-white').removeClass('text-gray-600');
      $('#tab-chat').removeClass('text-fuchsia-700 border-b-2 border-fuchsia-600 bg-white').addClass('text-gray-600');
      $('#tab-panel-assets').removeClass('hidden');
      $('#tab-panel-chat').addClass('hidden');
      renderAssetList();
      layoutInputAndVoiceControls();
    });
  });

  // --- Live2D Asset Management with backend API ---
  async function fetchAssetList() {
    const res = await fetch('/api/assets/list');
    if (!res.ok) return [];
    return await res.json();
  }
  async function renderAssetList() {
    const ul = $('#asset-list');
    ul.empty();
    const list = await fetchAssetList();
    if (!list.length) {
      ul.append('<li class="text-gray-400">No assets found.</li>');
      return;
    }
    list.forEach((path, idx) => {
      ul.append(`<li class="flex items-center gap-2 mb-1">
        <span class="flex-1 truncate">${path}</span>
        <button class="bg-fuchsia-500 hover:bg-fuchsia-700 text-white px-2 py-1 rounded text-xs load-asset-btn" data-path="${path}">Load</button>
        <button class="bg-gray-300 hover:bg-red-400 text-gray-700 hover:text-white px-2 py-1 rounded text-xs remove-asset-btn" data-path="${path}">Remove</button>
      </li>`);
    });
  }
  $(document).on('click', '#add-asset-btn', async function() {
    // No longer needed, as upload is handled by file input
  });
  $(document).on('click', '.remove-asset-btn', async function() {
    const path = $(this).data('path');
    if (!confirm('Delete this asset?')) return;
    await fetch('/api/assets/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    });
    renderAssetList();
  });
  $(document).on('click', '.load-asset-btn', async function() {
    const path = $(this).data('path');
    const success = await loadLive2DModel(path);
    if (success) {
      currentLive2DModelPath = path;
      showOverlayNotification('Live2D model loaded from asset list!');
    }
  });
});

// --- Live2D response indicator logic ---
function showLive2DResponding(show) {
  const el = $('#live2d-responding');
  if (show) {
    el.removeClass('hidden');
  } else {
    el.addClass('hidden');
  }
}

// Add CSS for animated dots
$('<style>\
.dot-anim { opacity: 0.3; animation: dotFade 1.2s infinite; font-size: 1.5em; }\
.dot-anim:nth-child(3) { animation-delay: 0.2s; }\
.dot-anim:nth-child(4) { animation-delay: 0.4s; }\
@keyframes dotFade { 0%,80%,100%{opacity:0.3;} 40%{opacity:1;} }\
</style>').appendTo('head');

// Add CSS for vivid animation
$('<style>\
.chat-row-anim { opacity: 0; transform: translateY(30px); transition: all 0.5s cubic-bezier(.4,2,.6,1); }\
.chat-row-anim.animate-slide-in { opacity: 1 !important; transform: translateY(0) !important; }\
.chat-bubble { transition: box-shadow 0.3s; }\
.user-bubble { background: linear-gradient(90deg,#22d3ee22,#a855f722); box-shadow: 0 2px 8px #22d3ee33; }\
.ai-bubble { background: linear-gradient(90deg,#a855f722,#22d3ee22); box-shadow: 0 2px 8px #a855f733; }\
</style>').appendTo('head');

// Update the loading text to show current model name
function updateLoadingText() {
  const agent = getAgentInfo(currentLive2DModelPath);
  $('#loading-text').text(`${agent.name} is responding...`);
}

// Update the tab menu layout and functionality
function updateTabMenu() {
  const tabMenu = $('.tab-menu');
  tabMenu.css({
    'display': 'flex',
    'gap': '1rem',
    'padding': '1rem',
    'background': 'rgba(0, 0, 0, 0.8)',
    'backdrop-filter': 'blur(10px)',
    'border-bottom': '1px solid rgba(255, 255, 255, 0.1)',
    'width': '100%',
    'box-sizing': 'border-box',
    'position': 'sticky',
    'top': '0',
    'z-index': '20'
  });

  // Update tab buttons
  $('.tab-button').css({
    'padding': '0.5rem 1rem',
    'border-radius': '0.5rem',
    'background': 'rgba(255, 255, 255, 0.1)',
    'color': 'white',
    'border': 'none',
    'cursor': 'pointer',
    'transition': 'all 0.3s ease',
    'font-size': '0.875rem',
    'font-weight': '500',
    'white-space': 'nowrap'
  });

  $('.tab-button.active').css({
    'background': 'rgba(255, 255, 255, 0.2)',
    'box-shadow': '0 0 10px rgba(255, 255, 255, 0.1)'
  });

  // Update tab panels
  $('.tab-panel').css({
    'display': 'none',
    'height': 'calc(100% - 60px)', // Account for tab menu height
    'overflow': 'hidden'
  });

  $('.tab-panel.active').css({
    'display': 'block'
  });
}

// Update the tab switching function
function switchTab(tabId) {
  // Hide all tab panels
  $('.tab-panel').removeClass('active').css('display', 'none');
  
  // Show selected tab panel
  $(`#${tabId}`).addClass('active').css('display', 'block');
  
  // Update tab buttons
  $('.tab-button').removeClass('active');
  $(`.tab-button[data-tab="${tabId}"]`).addClass('active');
  
  // Update layout for the active panel
  if (tabId === 'tab-panel-chat') {
    updateChatPanelLayout();
  }
}

// Update the chat panel layout
function updateChatPanelLayout() {
  const chatPanel = $('#tab-panel-chat');
  chatPanel.css({
    'display': 'flex',
    'flex-direction': 'column',
    'height': '100%',
    'width': '100%',
    'min-height': '0',
    'position': 'relative',
    'overflow': 'hidden'
  });

  // Update chat history container
  const chatHistory = $('#chat-history');
  chatHistory.css({
    'flex': '1',
    'overflow-y': 'auto',
    'padding': '1rem',
    'min-height': '0',
    'display': 'flex',
    'flex-direction': 'column',
    'gap': '1rem',
    'margin-bottom': '120px'
  });

  // Update input container
  const inputContainer = $('.input-container');
  inputContainer.css({
    'position': 'fixed',
    'bottom': '0',
    'left': '0',
    'right': '0',
    'background': 'rgba(0, 0, 0, 0.8)',
    'backdrop-filter': 'blur(10px)',
    'padding': '1rem',
    'border-top': '1px solid rgba(255, 255, 255, 0.1)',
    'width': '100%',
    'box-sizing': 'border-box',
    'z-index': '10'
  });

  // Update voice controls
  const voiceControls = $('.voice-controls');
  voiceControls.css({
    'position': 'fixed',
    'bottom': '60px',
    'left': '0',
    'right': '0',
    'background': 'rgba(0, 0, 0, 0.8)',
    'backdrop-filter': 'blur(10px)',
    'padding': '1rem',
    'border-top': '1px solid rgba(255, 255, 255, 0.1)',
    'width': '100%',
    'box-sizing': 'border-box',
    'display': 'flex',
    'flex-direction': 'column',
    'gap': '0.5rem',
    'z-index': '10'
  });
}

// Ensure input and voice controls are always at the bottom of the chat panel
function layoutInputAndVoiceControls() {
  // Remove any existing input/voice controls from other places
  $('.voice-controls').remove();
  $('.input-container').remove();
  // Only append if chat panel is visible
  if (!$('#tab-panel-chat').hasClass('hidden')) {
    $('#chat-container').append($('.voice-controls'));
    $('#chat-container').append($('.input-container'));
    // Fix their position
    $('.voice-controls, .input-container').css({
      'position': 'fixed',
      'left': $('#chat-container').offset() ? $('#chat-container').offset().left : 0,
      'width': $('#chat-container').width() || '100%',
      'z-index': 10
    });
    $('.voice-controls').css({
      'bottom': '60px',
      'right': 'auto',
      'background': 'rgba(0,0,0,0.8)',
      'backdrop-filter': 'blur(10px)',
      'padding': '1rem',
      'border-top': '1px solid rgba(255,255,255,0.1)'
    });
    $('.input-container').css({
      'bottom': '0',
      'right': 'auto',
      'background': 'rgba(0,0,0,0.8)',
      'backdrop-filter': 'blur(10px)',
      'padding': '1rem',
      'border-top': '1px solid rgba(255,255,255,0.1)'
    });
  }
}

// Initialize the UI
$(document).ready(() => {
  updateTabMenu();
  updateChatPanelLayout();
  updateLoadingText();
  
  // Add click handlers for tab buttons
  $('.tab-button').on('click', function() {
    const tabId = $(this).data('tab');
    switchTab(tabId);
  });
});

$(document).on('click', '#logout-btn', async function() {
  await fetch('/api/logout', { method: 'POST' });
  $('#app').hide();
  $('#login-page').show();
});

// Change Live2D is responding... text
function updateRespondingText() {
  let agentName = 'AI Agent';
  if (currentAgent && currentAgent.name) {
    agentName = currentAgent.name;
  } else if (typeof getAgentInfo === 'function' && typeof currentLive2DModelPath === 'string') {
    const info = getAgentInfo(currentLive2DModelPath);
    if (info && info.name) agentName = info.name;
  }
  $('#live2d-responding').contents().filter(function() {
    return this.nodeType === 3;
  }).remove();
  $('#live2d-responding').append(`${agentName} is thinking...`);
}
$(document).ready(updateRespondingText);

function showResponsePopup(text) {
  let popup = $('#response-popup');
  if (popup.length === 0) {
    popup = $('<div id="response-popup" class="fixed left-1/2 top-8 transform -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-lg text-lg font-bold bg-fuchsia-600 text-white hidden"></div>');
    $('body').append(popup);
  }
  popup.text(text).fadeIn(200);
  setTimeout(() => popup.fadeOut(800), 3000);
}

// --- Emoji picker logic ---
$(document).on('click', '#emoji-btn', function(e) {
  e.stopPropagation();
  const picker = $('#emoji-picker');
  picker.toggleClass('hidden');
  // Position picker below the button
  const btn = $(this);
  const offset = btn.offset();
  picker.css({
    top: btn.position().top - picker.outerHeight() - 8,
    left: btn.position().left - picker.outerWidth() + btn.outerWidth()
  });
});
$(document).on('click', '.emoji-item', function(e) {
  e.preventDefault();
  e.stopPropagation();
  const emoji = $(this).text();
  const input = $('#chat-input')[0];
  // Insert emoji at cursor position
  if (document.selection) {
    input.focus();
    var sel = document.selection.createRange();
    sel.text = emoji;
  } else if (input.selectionStart || input.selectionStart === 0) {
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const value = input.value;
    input.value = value.substring(0, start) + emoji + value.substring(end);
    input.selectionStart = input.selectionEnd = start + emoji.length;
    input.focus();
  } else {
    input.value += emoji;
    input.focus();
  }
  $('#emoji-picker').addClass('hidden');
});
// Hide emoji picker when clicking outside
$(document).on('click', function(e) {
  if (!$(e.target).closest('#emoji-picker, #emoji-btn').length) {
    $('#emoji-picker').addClass('hidden');
  }
});

// --- Tab menu toggle logic for improved tab buttons ---
function updateTabButtons(activeTab) {
  if (activeTab === 'tab-panel-chat') {
    $('#tab-chat').removeClass('hidden');
    $('#tab-chat-inactive').addClass('hidden');
    $('#tab-assets').addClass('hidden');
    $('#tab-assets-inactive').removeClass('hidden');
    $('#tab-panel-chat').removeClass('hidden');
    $('#tab-panel-assets').addClass('hidden');
  } else if (activeTab === 'tab-panel-assets') {
    $('#tab-chat').addClass('hidden');
    $('#tab-chat-inactive').removeClass('hidden');
    $('#tab-assets').removeClass('hidden');
    $('#tab-assets-inactive').addClass('hidden');
    $('#tab-panel-assets').removeClass('hidden');
    $('#tab-panel-chat').addClass('hidden');
    renderAssetList();
  }
  layoutInputAndVoiceControls();
}
// Override tab button click handlers to use new logic
$(document).on('click', '#tab-chat, #tab-chat-inactive', function() {
  updateTabButtons('tab-panel-chat');
});
$(document).on('click', '#tab-assets, #tab-assets-inactive', function() {
  updateTabButtons('tab-panel-assets');
});
// On page load, set initial tab state
$(document).ready(function() {
  updateTabButtons('tab-panel-chat');
});
