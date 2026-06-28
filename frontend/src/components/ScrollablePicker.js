import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Box, Typography, TextField, Button, Paper } from '@mui/material';

const ScrollablePicker = ({
  items,
  value,
  onChange,
  label,
  itemHeight = 40,
  visibleItems = 5,
  getItemLabel = (item) => item.name || item.toString(),
  getItemValue = (item) => item.id || item,
  grouped = false,
  getGroupLabel = (group) => group.label || group.name,
  searchEnabled = false,
  searchPlaceholder = 'Search...',
  buttonHeight = 40,
  inputBackground = 'background.paper',
  autoFocusSearch = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [buttonRef, setButtonRef] = useState(null);
  const [menuRef, setMenuRef] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [menuStyle, setMenuStyle] = useState(null);
  const containerHeight = itemHeight * visibleItems;

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    function handleClickAway(event) {
      if (
        buttonRef &&
        !buttonRef.contains(event.target) &&
        menuRef &&
        !menuRef.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickAway);
    document.addEventListener('touchstart', handleClickAway);
    return () => {
      document.removeEventListener('mousedown', handleClickAway);
      document.removeEventListener('touchstart', handleClickAway);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, buttonRef, menuRef]);

  const updateMenuPosition = useCallback(() => {
    if (!buttonRef) return;
    const rect = buttonRef.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const spaceBelow = viewportHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const shouldPlaceAbove = spaceBelow < 200 && spaceAbove > spaceBelow;
    // The search bar sits above the scrollable list inside the menu, so the
    // menu needs room for both: list (containerHeight) + search bar (~53px).
    const searchOffset = searchEnabled ? 53 : 0;
    const desiredHeight = containerHeight + searchOffset;
    const maxHeight = Math.max(140, Math.min(desiredHeight, shouldPlaceAbove ? spaceAbove : spaceBelow));
    const top = shouldPlaceAbove ? rect.top - maxHeight - 4 : rect.bottom + 4;
    setMenuStyle({
      top: Math.max(8, top),
      left: rect.left,
      width: rect.width,
      maxHeight,
    });
  }, [buttonRef, containerHeight, searchEnabled]);

  useEffect(() => {
    if (!isOpen) return;
    updateMenuPosition();
    const handleResize = () => updateMenuPosition();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, updateMenuPosition]);

  useEffect(() => {
    if (!isOpen) setSearchTerm('');
  }, [isOpen]);

  const handleItemClick = (item) => {
    onChange(getItemValue(item));
    setIsOpen(false);
  };

  const getSelectedItemLabel = () => {
    if (!value) return label;
    if (grouped) {
      for (const group of items) {
        const found = group.items.find((item) => getItemValue(item) === value);
        if (found) return getItemLabel(found);
      }
      return 'Select...';
    }
    const found = items.find((item) => getItemValue(item) === value);
    return found ? getItemLabel(found) : 'Select...';
  };

  const renderItems = () => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const matchesSearch = (item) => {
      if (!normalizedSearch) return true;
      return String(getItemLabel(item)).toLowerCase().includes(normalizedSearch);
    };

    if (grouped) {
      const filteredGroups = items
        .map((group) => ({ ...group, items: group.items.filter(matchesSearch) }))
        .filter((group) => group.items.length > 0);

      if (filteredGroups.length === 0) {
        return (
          <Box sx={{ py: 2, px: 2, color: 'text.secondary' }}>
            <Typography variant="body2" sx={{ fontSize: 11 }}>No matches</Typography>
          </Box>
        );
      }

      return filteredGroups.map((group) => (
        <React.Fragment key={group.label || group.name}>
          <Box
            sx={{
              py: 1,
              px: 2,
              backgroundColor: 'background.default',
              borderBottom: '1px solid',
              borderColor: 'divider',
              fontWeight: 600,
              fontSize: 11,
              color: 'text.secondary',
            }}
          >
            {getGroupLabel(group)}
          </Box>
          {group.items.map((item, index) => (
            <Box
              key={getItemValue(item)}
              onClick={() => handleItemClick(item)}
              sx={{
                py: 1,
                px: 3,
                cursor: 'pointer',
                backgroundColor: getItemValue(item) === value ? 'primary.light' : 'transparent',
                color: getItemValue(item) === value ? 'primary.contrastText' : 'text.primary',
                '&:hover': {
                  backgroundColor: getItemValue(item) === value ? 'primary.light' : 'background.default',
                },
                borderBottom: index < group.items.length - 1 ? '1px solid' : 'none',
                borderColor: 'divider',
              }}
            >
              <Typography variant="body2" sx={{ fontSize: 12 }}>
                {getItemLabel(item)}
              </Typography>
            </Box>
          ))}
        </React.Fragment>
      ));
    }

    const filteredItems = items.filter(matchesSearch);
    if (filteredItems.length === 0) {
      return (
        <Box sx={{ py: 2, px: 2, color: 'text.secondary' }}>
          <Typography variant="body2" sx={{ fontSize: 11 }}>No matches</Typography>
        </Box>
      );
    }

    return filteredItems.map((item, index) => (
      <Box
        key={getItemValue(item)}
        onClick={() => handleItemClick(item)}
        sx={{
          py: 1,
          px: 2,
          cursor: 'pointer',
          backgroundColor: getItemValue(item) === value ? 'primary.light' : 'transparent',
          color: getItemValue(item) === value ? 'primary.contrastText' : 'text.primary',
          '&:hover': {
            backgroundColor: getItemValue(item) === value ? 'primary.light' : 'background.default',
          },
          borderBottom: index < filteredItems.length - 1 ? '1px solid' : 'none',
          borderColor: 'divider',
        }}
      >
        <Typography variant="body2" sx={{ fontSize: 12 }}>
          {getItemLabel(item)}
        </Typography>
      </Box>
    ));
  };

  return (
    <Box sx={{ position: 'relative', width: '100%' }}>
      <Button
        ref={setButtonRef}
        variant="outlined"
        onClick={() => setIsOpen(!isOpen)}
        fullWidth
        sx={{
          justifyContent: 'space-between',
          textAlign: 'left',
          py: 1.2,
          px: 1.5,
          borderColor: 'divider',
          backgroundColor: inputBackground,
          color: 'text.primary',
          borderRadius: 2,
          fontWeight: 500,
          fontSize: 13,
          '&:hover': {
            borderColor: 'primary.main',
            backgroundColor: inputBackground,
          },
          minWidth: 0,
          overflow: 'hidden',
          height: buttonHeight,
        }}
      >
        <Typography
          sx={{
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 13,
          }}
        >
          {getSelectedItemLabel()}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0, ml: 1, fontSize: 13 }}>
          ▼
        </Typography>
      </Button>

      {isOpen &&
        buttonRef &&
        menuStyle &&
        ReactDOM.createPortal(
          <Paper
            ref={setMenuRef}
            elevation={2}
            sx={{
              position: 'fixed',
              zIndex: 9999,
              width: menuStyle.width,
              maxHeight: menuStyle.maxHeight,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              backgroundColor: 'background.paper',
              top: menuStyle.top,
              left: menuStyle.left,
              transform: 'translateZ(0)',
              willChange: 'transform',
            }}
          >
            <>
              {searchEnabled && (
                <Box sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
                  <TextField
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={searchPlaceholder}
                    size="small"
                    fullWidth
                    autoFocus={autoFocusSearch}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        height: 36,
                        backgroundColor: inputBackground,
                        '& fieldset': { borderColor: 'divider' },
                        '&:hover fieldset': { borderColor: 'primary.main' },
                        '&.Mui-focused fieldset': { borderColor: 'primary.main' },
                      },
                      '& .MuiInputBase-input': { fontSize: 13 },
                    }}
                  />
                </Box>
              )}
              <Box
                sx={{
                  flex: '1 1 auto',
                  minHeight: 0,
                  maxHeight: containerHeight,
                  overflow: 'auto',
                  '&::-webkit-scrollbar': { display: 'none' },
                  msOverflowStyle: 'none',
                  scrollbarWidth: 'none',
                }}
              >
                {renderItems()}
              </Box>
            </>
          </Paper>,
          document.body
        )}
    </Box>
  );
};

export default ScrollablePicker;
