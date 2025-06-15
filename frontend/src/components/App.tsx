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

interface ChatCommand {
  type: 'list-assets' | 'delete-asset' | 'rename-asset' | 'download-asset' | 'preview-asset' | 'switch-model';
  directory?: string;
  path?: string;
  oldPath?: string;
  newPath?: string;
}

// Helper to create a new message
function createMessage(sender: 'user' | 'assistant', text: string): Message {
  return {
    sender,
    text,
    time: new Date().toISOString(),
  };
}

// Chat command parsing for model/asset control
function parseChatCommand(input: string): ChatCommand | null {
  const lower = input.toLowerCase();
  
  // Asset management commands
  if (lower.startsWith('list assets') || lower.startsWith('show assets')) {
    const match = input.match(/(?:list|show) assets(?: in (.+))?/i);
    return { type: 'list-assets', directory: match?.[1]?.trim() || '' };
  }
  
  if (lower.startsWith('delete asset ')) {
    const match = input.match(/delete asset (.+)/i);
    if (match) return { type: 'delete-asset', path: match[1].trim() };
  }
  
  if (lower.startsWith('rename asset ')) {
    const match = input.match(/rename asset (.+) to (.+)/i);
    if (match) return { type: 'rename-asset', oldPath: match[1].trim(), newPath: match[2].trim() };
  }
  
  if (lower.startsWith('download asset ')) {
    const match = input.match(/download asset (.+)/i);
    if (match) return { type: 'download-asset', path: match[1].trim() };
  }
  
  if (lower.startsWith('preview asset ')) {
    const match = input.match(/preview asset (.+)/i);
    if (match) return { type: 'preview-asset', path: match[1].trim() };
  }
  
  // Existing commands
  if (lower.startsWith('switch to ')) {
    const match = input.match(/switch to (.+)/i);
    if (match) return { type: 'switch-model', path: match[1].trim() };
  }
  
  return null;
}

async function handleSendChat(input: string) {
  const cmd = parseChatCommand(input);
  if (cmd) {
    setMessages(msgs => [...msgs, createMessage('user', input)]);
    
    try {
      switch (cmd.type) {
        case 'list-assets': {
          const res = await fetch(`/api/assets/list${cmd.directory ? `?directory=${encodeURIComponent(cmd.directory)}` : ''}`);
          if (!res.ok) throw new Error('Failed to list assets');
          const assets = await res.json();
          const response = assets.length > 0 
            ? `Here are the assets${cmd.directory ? ` in ${cmd.directory}` : ''}:\n${assets.join('\n')}`
            : `No assets found${cmd.directory ? ` in ${cmd.directory}` : ''}.`;
          setMessages(msgs => [...msgs, createMessage('assistant', response)]);
          break;
        }
        
        case 'delete-asset': {
          const res = await fetch('/api/assets/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: cmd.path })
          });
          if (!res.ok) throw new Error('Failed to delete asset');
          setMessages(msgs => [...msgs, createMessage('assistant', `Successfully deleted asset: ${cmd.path}`)]);
          await fetchAssets(); // Refresh asset list
          break;
        }
        
        case 'rename-asset': {
          const res = await fetch('/api/assets/rename', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ old_path: cmd.oldPath, new_path: cmd.newPath })
          });
          if (!res.ok) throw new Error('Failed to rename asset');
          setMessages(msgs => [...msgs, createMessage('assistant', `Successfully renamed asset from ${cmd.oldPath} to ${cmd.newPath}`)]);
          await fetchAssets(); // Refresh asset list
          break;
        }
        
        case 'download-asset': {
          const a = document.createElement('a');
          a.href = `/api/assets/download?path=${encodeURIComponent(cmd.path)}`;
          a.download = cmd.path.split('/').pop() || 'asset';
          document.body.appendChild(a);
          a.click();
          a.remove();
          setMessages(msgs => [...msgs, createMessage('assistant', `Started download for asset: ${cmd.path}`)]);
          break;
        }
        
        case 'preview-asset': {
          const res = await fetch(`/api/assets/preview?path=${encodeURIComponent(cmd.path)}`);
          if (!res.ok) throw new Error('Failed to preview asset');
          const type = getAssetType(cmd.path);
          if (type === 'image') {
            setMessages(msgs => [...msgs, createMessage('assistant', `Here's the image preview for ${cmd.path}:\n![${cmd.path}](/api/assets/preview?path=${encodeURIComponent(cmd.path)})`)]);
          } else if (type === 'audio') {
            const audio = new Audio(`/api/assets/preview?path=${encodeURIComponent(cmd.path)}`);
            audio.play();
            setMessages(msgs => [...msgs, createMessage('assistant', `Playing audio: ${cmd.path}`)]);
          } else {
            const data = await res.json();
            setMessages(msgs => [...msgs, createMessage('assistant', `Content preview for ${cmd.path}:\n\`\`\`\n${data.content}\n\`\`\``)]);
          }
          break;
        }
        
        case 'switch-model': {
          if (cmd.path) setModelPath(cmd.path);
          setMessages(msgs => [...msgs, createMessage('assistant', `Switched to model: ${cmd.path}`)]);
          break;
        }
        
        // ... rest of existing command handlers ...
      }
    } catch (e: any) {
      setError(e.message);
      setMessages(msgs => [...msgs, createMessage('assistant', `Error: ${e.message}`)]);
    }
    return;
  }
  
  // Handle regular chat
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
  } catch (e: any) {
    setError(e.message);
    setResponding(false);
  }
}

// Helper function to determine asset type
function getAssetType(path: string): 'image' | 'audio' | 'model' | 'motion' | 'other' {
  const ext = path.toLowerCase().split('.').pop();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext || '')) return 'image';
  if (['wav', 'mp3', 'ogg'].includes(ext || '')) return 'audio';
  if (path.endsWith('.model3.json') || path.endsWith('.model.json')) return 'model';
  if (path.endsWith('.motion3.json')) return 'motion';
  return 'other';
}

// ... rest of existing code ... 