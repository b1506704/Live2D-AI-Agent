import React from 'react';
import { Box, Typography, Paper, Fade } from '@mui/material';
import { styled } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';

const PopupContainer = styled(Box)(({ theme }) => ({
  position: 'absolute',
  bottom: theme.spacing(4),
  left: '50%',
  transform: 'translateX(-50%)',
  maxWidth: '80%',
  zIndex: 10,
}));

const TranscriptBubble = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2, 3),
  background: 'rgba(0, 0, 0, 0.8)',
  backdropFilter: 'blur(10px)',
  borderRadius: theme.shape.borderRadius * 2,
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
}));

const TranscriptPopup = ({ text }) => {
  if (!text) return null;

  return (
    <AnimatePresence>
      <PopupContainer>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
        >
          <TranscriptBubble elevation={4}>
            <Typography
              variant="body1"
              sx={{
                color: 'white',
                textAlign: 'center',
                fontSize: '1.1rem',
                lineHeight: 1.6,
              }}
            >
              {text}
            </Typography>
          </TranscriptBubble>
        </motion.div>
      </PopupContainer>
    </AnimatePresence>
  );
};

export default TranscriptPopup;