import React, { useEffect, useRef } from 'react';
import { useAppStore } from '../store/appStore';

const AudioPlayer = ({ src, onEnded }) => {
  const audioRef = useRef(null);
  const { settings } = useAppStore();

  useEffect(() => {
    if (audioRef.current && src) {
      audioRef.current.volume = settings.audioVolume;
      
      if (settings.autoPlayAudio) {
        audioRef.current.play().catch(error => {
          console.error('Error playing audio:', error);
        });
      }
    }
  }, [src, settings.audioVolume, settings.autoPlayAudio]);

  return (
    <audio
      ref={audioRef}
      src={src}
      onEnded={onEnded}
      style={{ display: 'none' }}
    />
  );
};

export default AudioPlayer;