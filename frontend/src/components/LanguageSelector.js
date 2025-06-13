import React from 'react';
import { IconButton, Menu, MenuItem, Typography } from '@mui/material';
import LanguageIcon from '@mui/icons-material/Language';
import { styled } from '@mui/material/styles';

const StyledIconButton = styled(IconButton)(({ theme }) => ({
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  '&:hover': {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
}));

const LanguageSelector = ({ language, onChange }) => {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const open = Boolean(anchorEl);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLanguageChange = (lang) => {
    onChange(lang);
    handleClose();
  };

  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' },
  ];

  const currentLanguage = languages.find(lang => lang.code === language);

  return (
    <>
      <StyledIconButton
        color="primary"
        onClick={handleClick}
        aria-controls={open ? 'language-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
      >
        <Typography variant="body2" sx={{ mr: 0.5 }}>
          {currentLanguage?.flag}
        </Typography>
        <LanguageIcon />
      </StyledIconButton>
      <Menu
        id="language-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          'aria-labelledby': 'language-button',
        }}
      >
        {languages.map((lang) => (
          <MenuItem
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            selected={lang.code === language}
          >
            <Typography variant="body2" sx={{ mr: 1 }}>
              {lang.flag}
            </Typography>
            {lang.name}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default LanguageSelector;