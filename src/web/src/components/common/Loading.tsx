import React from 'react'; // ^18.0.0
import { Spinner } from '@blitzy/premium-ui'; // ^2.0.0
import classNames from 'classnames'; // ^2.3.0
import { useTheme } from '../../hooks/useTheme';
import type { BlitzyThemeConfig } from '../../types/blitzy';

// Loading component size mappings in pixels
const LOADING_SIZES = {
  sm: 16,
  md: 24,
  lg: 32,
  touch: 44, // WCAG 2.1 minimum touch target size
} as const;

// Z-index for loading overlay
const Z_INDEX_LOADING = 1000;

interface LoadingProps {
  /** Size of the loading spinner - can be predefined or custom number */
  size?: keyof typeof LOADING_SIZES | number;
  /** Whether to show a full-screen overlay */
  overlay?: boolean;
  /** Optional loading text for screen readers */
  text?: string;
  /** Additional CSS classes */
  className?: string;
  /** Test ID for automated testing */
  testId?: string;
}

/**
 * A theme-aware loading spinner component with accessibility support
 * Implements WCAG 2.1 Level AA compliance for animation and contrast
 */
export const Loading = React.memo(({
  size = 'md',
  overlay = false,
  text = 'Loading...',
  className,
  testId = 'loading-spinner',
}: LoadingProps) => {
  const { theme } = useTheme();

  // Calculate spinner size
  const spinnerSize = typeof size === 'number' 
    ? size 
    : LOADING_SIZES[size];

  // Generate container classes
  const containerClasses = classNames(
    'cs-loading',
    {
      'cs-loading--overlay': overlay,
      'cs-loading--high-contrast': theme.mode === 'high-contrast',
    },
    className
  );

  // Generate backdrop classes for overlay mode
  const backdropClasses = classNames(
    'cs-loading__backdrop',
    {
      'cs-loading__backdrop--blur': theme.mode !== 'high-contrast',
    }
  );

  // Generate spinner color based on theme
  const getSpinnerColor = (theme: BlitzyThemeConfig) => {
    switch (theme.mode) {
      case 'dark':
        return theme.colors.primary;
      case 'high-contrast':
        return theme.colors.text;
      default:
        return theme.colors.primary;
    }
  };

  // Generate text color based on theme
  const getTextColor = (theme: BlitzyThemeConfig) => {
    return theme.mode === 'high-contrast' 
      ? theme.colors.text 
      : theme.colors.textSecondary;
  };

  return (
    <div
      className={containerClasses}
      data-testid={testId}
      role="status"
      aria-live="polite"
      aria-busy="true"
      style={{
        zIndex: overlay ? Z_INDEX_LOADING : undefined,
      }}
    >
      {overlay && (
        <div 
          className={backdropClasses}
          style={{
            backgroundColor: theme.mode === 'dark' 
              ? 'rgba(0, 0, 0, 0.75)' 
              : 'rgba(255, 255, 255, 0.75)',
          }}
        />
      )}
      
      <div className="cs-loading__content">
        <Spinner
          size={spinnerSize}
          color={getSpinnerColor(theme)}
          aria-hidden="true"
          speed={theme.mode === 'high-contrast' ? 'slow' : 'normal'}
        />
        
        {text && (
          <span 
            className="cs-loading__text"
            style={{
              color: getTextColor(theme),
              marginTop: spinnerSize * 0.5,
              fontSize: size === 'sm' ? '0.875rem' : '1rem',
            }}
          >
            {text}
          </span>
        )}
      </div>
    </div>
  );
});

Loading.displayName = 'Loading';

export default Loading;