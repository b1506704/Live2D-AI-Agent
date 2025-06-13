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
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SearchIcon from '@mui/icons-material/Search';
import CalculateIcon from '@mui/icons-material/Calculate';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CloudIcon from '@mui/icons-material/Cloud';
import { styled } from '@mui/material/styles';

const TaskChip = styled(Chip)(({ theme }) => ({
  margin: theme.spacing(0.5),
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
}));

const TaskExecutor = ({ open, onClose, onExecute }) => {
  const [task, setTask] = useState('');

  const suggestedTasks = [
    "Search for the latest AI news",
    "Calculate 15% tip on $87.50",
    "What's the weather in Tokyo?",
    "Get current time in different timezones",
    "Write a haiku about technology",
    "Summarize benefits of meditation",
  ];

  const taskCategories = [
    { icon: <SearchIcon />, name: 'Web Search', description: 'Search the internet for information' },
    { icon: <CalculateIcon />, name: 'Calculator', description: 'Perform mathematical calculations' },
    { icon: <AccessTimeIcon />, name: 'Time & Date', description: 'Get current time and date info' },
    { icon: <CloudIcon />, name: 'Weather', description: 'Check weather conditions' },
  ];

  const handleExecute = () => {
    if (task.trim()) {
      onExecute(task);
      handleClose();
    }
  };

  const handleClose = () => {
    setTask('');
    onClose();
  };

  const handleSuggestedTask = (suggestedTask) => {
    setTask(suggestedTask);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Execute Agentic Task
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
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            The AI agent can perform various tasks using available tools:
          </Typography>
          
          <List dense>
            {taskCategories.map((category, index) => (
              <ListItem key={index}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  {category.icon}
                </ListItemIcon>
                <ListItemText
                  primary={category.name}
                  secondary={category.description}
                />
              </ListItem>
            ))}
          </List>
        </Box>

        <TextField
          fullWidth
          multiline
          rows={3}
          label="Describe the task"
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="What would you like the AI agent to do?"
          sx={{ mb: 2 }}
        />

        <Box>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Suggested tasks:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', mt: 1 }}>
            {suggestedTasks.map((suggestedTask, index) => (
              <TaskChip
                key={index}
                label={suggestedTask}
                size="small"
                onClick={() => handleSuggestedTask(suggestedTask)}
              />
            ))}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleExecute}
          variant="contained"
          disabled={!task.trim()}
          startIcon={<PlayArrowIcon />}
        >
          Execute Task
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TaskExecutor;