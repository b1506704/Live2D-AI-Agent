import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  IconButton,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useDropzone } from 'react-dropzone';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloseIcon from '@mui/icons-material/Close';
import ImageIcon from '@mui/icons-material/Image';

const DropzoneContainer = styled(Box)(({ theme, isDragActive }) => ({
  border: `2px dashed ${isDragActive ? theme.palette.primary.main : theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(4),
  textAlign: 'center',
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  backgroundColor: isDragActive ? theme.palette.action.hover : 'transparent',
  '&:hover': {
    borderColor: theme.palette.primary.main,
    backgroundColor: theme.palette.action.hover,
  },
}));

const PreviewImage = styled('img')({
  maxWidth: '100%',
  maxHeight: 300,
  borderRadius: 8,
  marginTop: 16,
});

const ImageUploader = ({ open, onClose, onUpload }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [prompt, setPrompt] = useState('');

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp']
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (file) {
        setSelectedFile(file);
        const reader = new FileReader();
        reader.onload = () => {
          setPreview(reader.result);
        };
        reader.readAsDataURL(file);
      }
    },
  });

  const handleUpload = () => {
    if (selectedFile) {
      onUpload(selectedFile, prompt);
      handleClose();
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setPreview(null);
    setPrompt('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Upload Image
        <IconButton
          aria-label="close"
          onClick={handleClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent>
        <DropzoneContainer {...getRootProps()} isDragActive={isDragActive}>
          <input {...getInputProps()} />
          <CloudUploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            {isDragActive ? 'Drop the image here' : 'Drag & drop an image here'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            or click to select a file
          </Typography>
        </DropzoneContainer>

        {preview && (
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <PreviewImage src={preview} alt="Preview" />
            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
              {selectedFile.name}
            </Typography>
          </Box>
        )}

        <TextField
          fullWidth
          multiline
          rows={2}
          label="Add a question or comment (optional)"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          sx={{ mt: 2 }}
          placeholder="What would you like to know about this image?"
        />
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleUpload}
          variant="contained"
          disabled={!selectedFile}
          startIcon={<ImageIcon />}
        >
          Upload & Analyze
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ImageUploader;