import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Avatar,
  IconButton,
  Typography,
  CircularProgress,
  Box,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FaceIcon from '@mui/icons-material/Face';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { styled } from '@mui/material/styles';

const StyledListItem = styled(ListItem)(({ theme, selected }) => ({
  borderRadius: theme.shape.borderRadius,
  margin: theme.spacing(0.5, 0),
  backgroundColor: selected ? theme.palette.action.selected : 'transparent',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
}));

const ModelSelector = ({ open, onClose, selectedModel, onSelectModel }) => {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      fetchModels();
    }
  }, [open]);

  const fetchModels = async () => {
    try {
      const response = await fetch('/api/models');
      const data = await response.json();
      setModels(data.models || []);
    } catch (error) {
      console.error('Error fetching models:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        Select Live2D Model
        <IconButton
          aria-label="close"
          onClick={onClose}
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
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <List>
            {models.map((model) => (
              <StyledListItem
                key={model.id}
                disablePadding
                selected={model.id === selectedModel}
              >
                <ListItemButton onClick={() => onSelectModel(model.id)}>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                      <FaceIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={model.name}
                    secondary={model.default ? 'Default Model' : null}
                  />
                  {model.id === selectedModel && (
                    <CheckCircleIcon color="primary" />
                  )}
                </ListItemButton>
              </StyledListItem>
            ))}
          </List>
        )}

        {!loading && models.length === 0 && (
          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
            No models available
          </Typography>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ModelSelector;