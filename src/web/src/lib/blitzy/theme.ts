import React from 'react'; // ^18.0.0
import { type BlitzyThemeConfig } from '../../types/blitzy';
import lightTheme from '../../assets/styles/themes/light';
import darkTheme from '../../assets/styles/themes/dark';

// Theme context for providing theme state and management functions
interface ThemeContextValue {
  theme: BlitzyThemeConfig;
  setTheme: (theme: BlitzyThemeConfig) => void;
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

// Constants for theme management
const THEME_STORAGE_KEY = 'cs-platform-theme';
const THEME_VERSION = '1.0.0';
const THEME_TRANSITION_DURATION = 200;

// High contrast theme configuration
const highContrastTheme: BlitzyThemeConfig = {
  mode: 'high-contrast',
  colors: {
    ...lightTheme.colors,
    background: '#FFFFFF',
    text: '#000000',
    primary: '#0000EE',
    secondary: '#551A8B',
    border: '#000000',
  },
};

/**
 * Custom hook to access theme context and management functions
 */
export const useTheme = (): ThemeContextValue => {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

/**
 * Validates theme configuration against required properties
 */
const validateTheme = (theme: BlitzyThemeConfig): boolean => {
  return (
    theme &&
    typeof theme.mode === 'string' &&
    ['light', 'dark', 'high-contrast'].includes(theme.mode) &&
    theme.colors &&
    typeof theme.colors === 'object'
  );
};

/**
 * Migrates theme configuration to latest version
 */
const migrateTheme = (oldTheme: BlitzyThemeConfig): BlitzyThemeConfig => {
  // Add version-specific migrations here as needed
  return {
    ...oldTheme,
    version: THEME_VERSION,
  };
};

/**
 * Retrieves and validates initial theme from storage or system preferences
 */
const getInitialTheme = (): BlitzyThemeConfig => {
  try {
    // Check local storage for saved theme
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme) {
      const parsedTheme = JSON.parse(savedTheme);
      if (validateTheme(parsedTheme)) {
        if (parsedTheme.version !== THEME_VERSION) {
          return migrateTheme(parsedTheme);
        }
        return parsedTheme;
      }
    }

    // Check system preferences
    if (window.matchMedia) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const prefersContrast = window.matchMedia('(prefers-contrast: more)').matches;

      if (prefersContrast) {
        return highContrastTheme;
      }
      return prefersDark ? darkTheme : lightTheme;
    }

    return lightTheme;
  } catch (error) {
    console.error('Error getting initial theme:', error);
    return lightTheme;
  }
};

/**
 * Theme provider component with system preference detection and error boundary
 */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = React.useState<BlitzyThemeConfig>(getInitialTheme);
  const colorSchemeQuery = React.useRef<MediaQueryList>();
  const contrastQuery = React.useRef<MediaQueryList>();

  // Apply theme CSS variables to document root
  const applyTheme = React.useCallback((newTheme: BlitzyThemeConfig) => {
    const root = document.documentElement;
    Object.entries(newTheme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--theme-${key}`, value);
    });
  }, []);

  // Handle theme changes with validation and persistence
  const handleThemeChange = React.useCallback((newTheme: BlitzyThemeConfig) => {
    if (!validateTheme(newTheme)) {
      console.error('Invalid theme configuration:', newTheme);
      return;
    }

    // Start transition
    document.documentElement.classList.add('theme-transitioning');

    // Update theme
    setThemeState(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(newTheme));
    applyTheme(newTheme);

    // Emit theme change event
    window.dispatchEvent(new CustomEvent('themechange', { detail: newTheme }));

    // Complete transition
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transitioning');
    }, THEME_TRANSITION_DURATION);
  }, [applyTheme]);

  // Handle system preference changes
  const handleSystemPreference = React.useCallback((event: MediaQueryListEvent) => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (!savedTheme) {
      if (event.matches) {
        handleThemeChange(event.media.includes('contrast') ? highContrastTheme : darkTheme);
      } else {
        handleThemeChange(lightTheme);
      }
    }
  }, [handleThemeChange]);

  // Initialize system preference listeners
  React.useEffect(() => {
    if (window.matchMedia) {
      colorSchemeQuery.current = window.matchMedia('(prefers-color-scheme: dark)');
      contrastQuery.current = window.matchMedia('(prefers-contrast: more)');

      colorSchemeQuery.current.addEventListener('change', handleSystemPreference);
      contrastQuery.current.addEventListener('change', handleSystemPreference);

      // Apply initial theme
      applyTheme(theme);

      return () => {
        colorSchemeQuery.current?.removeEventListener('change', handleSystemPreference);
        contrastQuery.current?.removeEventListener('change', handleSystemPreference);
      };
    }
  }, [theme, applyTheme, handleSystemPreference]);

  // Error boundary for theme operations
  const [hasError, setHasError] = React.useState(false);
  if (hasError) {
    return (
      <div role="alert">
        Theme system error. Falling back to light theme.
        <button onClick={() => {
          setHasError(false);
          handleThemeChange(lightTheme);
        }}>
          Reset Theme
        </button>
      </div>
    );
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme: handleThemeChange,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};