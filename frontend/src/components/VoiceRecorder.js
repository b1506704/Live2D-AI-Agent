import React, { useEffect, useRef } from 'react';
import { ReactMic } from 'react-mic';
import { Box } from '@mui/material';
import { styled } from '@mui/material/styles';

const RecorderContainer = styled(Box)({
  position: 'fixed',
  bottom: -200,
  left: 0,
  width: '100%',
  height: 100,
  pointerEvents: 'none',
});

const VoiceRecorder = ({ isRecording, onStop }) => {
  const onData = (recordedBlob) => {
    // This is called multiple times during recording
    // We can use it to show audio visualization if needed
  };

  const onStopRecording = (recordedBlob) => {
    // Convert blob to File for upload
    const audioFile = new File([recordedBlob.blob], 'recording.wav', {
      type: 'audio/wav',
    });
    onStop(audioFile);
  };

  return (
    <RecorderContainer>
      <ReactMic
        record={isRecording}
        className="sound-wave"
        onStop={onStopRecording}
        onData={onData}
        strokeColor="#00bcd4"
        backgroundColor="#0a0e27"
        mimeType="audio/wav"
        echoCancellation={true}
        autoGainControl={true}
        noiseSuppression={true}
      />
    </RecorderContainer>
  );
};

export default VoiceRecorder;