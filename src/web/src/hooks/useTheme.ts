import React, { useEffect, useState, useCallback } from 'react'; // ^18.0.0
import debounce from 'lodash/debounce'; // ^4.17.21
import { type BlitzyThemeConfig } from '../../types/blitzy';
import lightTheme from '../../assets/styles/themes/light';
import darkTheme from '../../assets/styles/themes/dark';

// Storage key for persisting theme preferences
const THEME_STORAGE_KEY = 'cs-platform-theme';

// Custom event for theme changes
const THEME_CHANGE_EVENT = 'cs-theme-change';

/**
 * Helper function to detect system theme and contrast preferences
 * @returns {Object} System theme preferences
 */
const getSystemTheme = (): Pick<BlitzyThemeConfig, 'mode'> => {
  if (typeof window === 'undefined') return { mode: 'light' };

  try {
    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isHighContrast = window.matchMedia('(prefers-contrast: more)').matches;

    return {
      mode: isHighContrast ? 'high-contrast' : isDarkMode ? 'dark' : 'light'
    };
  } catch (error) {
    console.warn('Error detecting system theme:', error);
    return { mode: 'light' };
  }
};

/**
 * Helper function to get stored theme from localStorage
 * @returns {BlitzyThemeConfig | null} Stored theme configuration or null
 */
const getStoredTheme = (): BlitzyThemeConfig | null => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    
    // Validate stored theme structure
    if (
      typeof parsed === 'object' &&
      ['light', 'dark', 'high-contrast'].includes(parsed.mode) &&
      typeof parsed.colors === 'object'
    ) {
      return parsed as BlitzyThemeConfig;
    }
    
    return null;
  } catch (error) {
    console.warn('Error reading stored theme:', error);
    localStorage.removeItem(THEME_STORAGE_KEY);
    return null;
  }
};

/**
 * Custom hook for managing theme state and preferences
 * Provides theme configuration and theme switching functionality
 * Implements system preference detection and theme persistence
 * @returns {Object} Theme management functions and current theme
 */
export const useTheme = () => {
  // Initialize theme state with stored or system preference
  const [theme, setThemeState] = useState<BlitzyThemeConfig>(() => {
    const stored = getStoredTheme();
    if (stored) return stored;

    const { mode } = getSystemTheme();
    return mode === 'dark' ? darkTheme : lightTheme;
  });

  // Persist theme changes to localStorage with debounce
  const persistTheme = useCallback(
    debounce((newTheme: BlitzyThemeConfig) => {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(newTheme));
      } catch (error) {
        console.error('Error persisting theme:', error);
      }
    }, 500),
    []
  );

  // Handle theme updates with validation and persistence
  const setTheme = useCallback((newTheme: BlitzyThemeConfig) => {
    // Validate theme configuration
    if (!newTheme || !newTheme.mode || !newTheme.colors) {
      console.error('Invalid theme configuration:', newTheme);
      return;
    }

    setThemeState(newTheme);
    persistTheme(newTheme);

    // Broadcast theme change event
    window.dispatchEvent(
      new CustomEvent(THEME_CHANGE_EVENT, { detail: newTheme })
    );
  }, [persistTheme]);

  // Toggle between light and dark themes
  const toggleTheme = useCallback(() => {
    setTheme(theme.mode === 'light' ? darkTheme : lightTheme);
  }, [theme.mode, setTheme]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const contrastQuery = window.matchMedia('(prefers-contrast: more)');

    const handleChange = () => {
      const stored = getStoredTheme();
      if (!stored) {
        const { mode } = getSystemTheme();
        setTheme(mode === 'dark' ? darkTheme : lightTheme);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    contrastQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
      contrastQuery.removeEventListener('change', handleChange);
    };
  }, [setTheme]);

  // Clean up debounced function on unmount
  useEffect(() => {
    return () => {
      persistTheme.cancel();
    };
  }, [persistTheme]);

  return {
    theme,
    setTheme,
    toggleTheme
  };
};

export default useTheme;