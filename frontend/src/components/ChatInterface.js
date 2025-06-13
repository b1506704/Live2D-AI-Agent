import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  TextField,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Typography,
  Paper,
  Divider,
  CircularProgress
} from '@mui/material';
import { styled } from '@mui/material/styles';
import SendIcon from '@mui/icons-material/Send';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import { useAppStore } from '../store/appStore';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const ChatContainer = styled(Box)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  background: theme.palette.background.paper,
}));

const MessagesContainer = styled(Box)(({ theme }) => ({
  flexGrow: 1,
  overflow: 'auto',
  padding: theme.spacing(2),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
}));

const MessageBubble = styled(Paper)(({ theme, isUser }) => ({
  padding: theme.spacing(1.5, 2),
  maxWidth: '80%',
  alignSelf: isUser ? 'flex-end' : 'flex-start',
  background: isUser
    ? theme.palette.primary.main
    : theme.palette.background.default,
  color: isUser ? '#fff' : theme.palette.text.primary,
  borderRadius: isUser
    ? '18px 18px 4px 18px'
    : '18px 18px 18px 4px',
}));

const InputContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  borderTop: `1px solid ${theme.palette.divider}`,
  display: 'flex',
  gap: theme.spacing(1),
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: '24px',
  },
}));

const ChatInterface = ({ onAudioResponse, selectedModel, language }) => {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const { chatHistory, addChatMessage } = useAppStore();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  const handleSendMessage = async () => {
    if (!message.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      text: message,
      sender: 'user',
      timestamp: new Date().toISOString(),
    };

    addChatMessage(userMessage);
    setMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          language: language,
          live2d_model: selectedModel,
          generate_audio: true,
        }),
      });

      const data = await response.json();

      // Add AI response to chat
      const aiMessage = {
        id: Date.now() + 1,
        text: data.response,
        sender: 'ai',
        timestamp: data.timestamp,
      };

      addChatMessage(aiMessage);

      // Handle audio response
      if (data.audio && onAudioResponse) {
        onAudioResponse(data.audio, data.phonemes);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <ChatContainer>
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" component="h2">
          Chat with {selectedModel}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Language: {language === 'en' ? 'English' : '日本語'}
        </Typography>
      </Box>

      <MessagesContainer>
        <AnimatePresence>
          {chatHistory.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1,
                  flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row',
                }}
              >
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: msg.sender === 'user' ? 'primary.main' : 'secondary.main',
                  }}
                >
                  {msg.sender === 'user' ? <PersonIcon /> : <SmartToyIcon />}
                </Avatar>
                
                <Box sx={{ maxWidth: '80%' }}>
                  <MessageBubble elevation={1} isUser={msg.sender === 'user'}>
                    <Typography variant="body2">
                      {msg.text}
                    </Typography>
                  </MessageBubble>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      display: 'block',
                      mt: 0.5,
                      textAlign: msg.sender === 'user' ? 'right' : 'left',
                    }}
                  >
                    {formatTime(msg.timestamp)}
                  </Typography>
                </Box>
              </Box>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {isLoading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
              <SmartToyIcon />
            </Avatar>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <CircularProgress size={8} />
              <CircularProgress size={8} />
              <CircularProgress size={8} />
            </Box>
          </Box>
        )}
        
        <div ref={messagesEndRef} />
      </MessagesContainer>

      <InputContainer>
        <StyledTextField
          fullWidth
          variant="outlined"
          placeholder={language === 'en' ? "Type a message..." : "メッセージを入力..."}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isLoading}
          size="small"
          multiline
          maxRows={3}
        />
        <IconButton
          color="primary"
          onClick={handleSendMessage}
          disabled={!message.trim() || isLoading}
          sx={{
            bgcolor: 'primary.main',
            color: 'white',
            '&:hover': {
              bgcolor: 'primary.dark',
            },
            '&:disabled': {
              bgcolor: 'action.disabledBackground',
            },
          }}
        >
          <SendIcon />
        </IconButton>
      </InputContainer>
    </ChatContainer>
  );
};

export default ChatInterface;