import React from 'react'; // ^18.0.0
import lightTheme from '../assets/styles/themes/light';
import darkTheme from '../assets/styles/themes/dark';
import { type BlitzyThemeConfig, type ThemeContextValue } from '../types/blitzy';

/**
 * Storage key for persisting theme preferences
 */
const STORAGE_KEY = 'cs-platform-theme';

/**
 * Default theme configuration implementing WCAG 2.1 Level AA compliance
 * Includes responsive breakpoints and color schemes for the Customer Success AI Platform
 */
export const defaultTheme: BlitzyThemeConfig = {
  mode: 'light',
  colors: lightTheme.colors,
  breakpoints: {
    mobile: 320,   // Mobile-first breakpoint
    tablet: 768,   // Tablet/iPad breakpoint
    desktop: 1024, // Desktop breakpoint
    large: 1440,   // Large display breakpoint
  },
};

/**
 * Theme context for global theme state management
 * Provides theme configuration and update mechanism throughout the application
 */
export const ThemeContext = React.createContext<ThemeContextValue>({
  theme: defaultTheme,
  setTheme: () => {},
});

/**
 * Custom hook for accessing and managing theme configuration
 * Implements theme persistence and memoization for performance optimization
 * 
 * @returns {ThemeContextValue} Theme context value with current theme and setter
 */
export const useTheme = (): ThemeContextValue => {
  const context = React.useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  // Memoize theme value to prevent unnecessary rerenders
  const memoizedValue = React.useMemo(() => {
    const loadTheme = (): BlitzyThemeConfig => {
      try {
        const savedTheme = localStorage.getItem(STORAGE_KEY);
        if (savedTheme) {
          const parsedTheme = JSON.parse(savedTheme);
          // Validate theme structure
          if (
            parsedTheme &&
            typeof parsedTheme.mode === 'string' &&
            parsedTheme.colors &&
            parsedTheme.breakpoints
          ) {
            return parsedTheme;
          }
        }
      } catch (error) {
        console.error('Error loading theme:', error);
      }
      return defaultTheme;
    };

    const currentTheme = loadTheme();

    const setTheme = (newTheme: BlitzyThemeConfig) => {
      try {
        // Validate theme mode
        if (!['light', 'dark', 'high-contrast'].includes(newTheme.mode)) {
          throw new Error('Invalid theme mode');
        }

        // Apply theme-specific color schemes
        const themeColors = newTheme.mode === 'dark' ? darkTheme.colors : lightTheme.colors;
        const updatedTheme = {
          ...newTheme,
          colors: themeColors,
        };

        // Persist theme preference
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTheme));
        
        // Update context
        context.setTheme(updatedTheme);

        // Apply theme class to root element for global CSS variables
        document.documentElement.setAttribute('data-theme', newTheme.mode);
        
        // Update color scheme meta tag for system preference
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
          metaThemeColor.setAttribute(
            'content',
            newTheme.mode === 'dark' ? darkTheme.colors.background : lightTheme.colors.background
          );
        }
      } catch (error) {
        console.error('Error setting theme:', error);
        context.setTheme(defaultTheme);
      }
    };

    return {
      theme: currentTheme,
      setTheme,
    };
  }, [context]);

  return memoizedValue;
};