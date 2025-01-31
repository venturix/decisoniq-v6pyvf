import React from 'react'; // ^18.0.0
import classNames from 'classnames'; // ^2.3.0
import { BlitzyUI } from '@blitzy/premium-ui'; // ^2.0.0
import { useTheme } from '../../lib/blitzy/theme';
import { type BlitzyThemeConfig } from '../../types/blitzy';

// Types for badge variants and custom colors
type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'default';
type BadgeSize = 'sm' | 'md' | 'lg';
type CustomColors = {
  background?: string;
  text?: string;
};

// Props interface for the Badge component
interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
  onClick?: () => void;
  role?: 'status' | 'badge' | string;
  ariaLabel?: string;
  customColors?: CustomColors;
}

// Theme-aware color calculation
const getThemeColors = (
  theme: BlitzyThemeConfig,
  variant: BadgeVariant,
  customColors?: CustomColors
) => {
  // Return custom colors if provided
  if (customColors?.background && customColors?.text) {
    return {
      background: customColors.background,
      color: customColors.text,
    };
  }

  // Default color mappings based on variant and theme
  const colorMap: Record<BadgeVariant, { background: string; color: string }> = {
    success: {
      background: theme.colors.success,
      color: theme.colors.text,
    },
    warning: {
      background: theme.colors.warning,
      color: theme.colors.text,
    },
    error: {
      background: theme.colors.danger,
      color: theme.colors.text,
    },
    info: {
      background: theme.colors.info,
      color: theme.colors.text,
    },
    default: {
      background: theme.colors.surface,
      color: theme.colors.text,
    },
  };

  // Apply high contrast adjustments if enabled
  if (theme.mode === 'high-contrast') {
    return {
      background: theme.colors.background,
      color: theme.colors.text,
    };
  }

  return colorMap[variant];
};

// Size configuration for the badge
const sizeConfig: Record<BadgeSize, { padding: string; fontSize: string }> = {
  sm: { padding: '0.25rem 0.5rem', fontSize: '0.75rem' },
  md: { padding: '0.375rem 0.75rem', fontSize: '0.875rem' },
  lg: { padding: '0.5rem 1rem', fontSize: '1rem' },
};

/**
 * Badge component for displaying status, labels, or counts with theme support
 * Follows Blitzy Enterprise Design System guidelines
 */
export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className,
  onClick,
  role = 'status',
  ariaLabel,
  customColors,
}) => {
  const { theme } = useTheme();
  const { background, color } = getThemeColors(theme, variant, customColors);
  const { padding, fontSize } = sizeConfig[size];

  // Dynamic styles based on theme and props
  const styles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding,
    fontSize,
    fontWeight: 500,
    lineHeight: 1.2,
    borderRadius: '0.375rem',
    background,
    color,
    transition: 'background-color 0.2s, color 0.2s',
    cursor: onClick ? 'pointer' : 'default',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  };

  // Interactive state styles
  if (onClick) {
    styles.cursor = 'pointer';
    styles[':hover'] = {
      filter: 'brightness(0.95)',
    };
    styles[':active'] = {
      filter: 'brightness(0.9)',
    };
  }

  return (
    <BlitzyUI.Box
      as="span"
      style={styles}
      className={classNames(
        'blitzy-badge',
        `blitzy-badge-${variant}`,
        `blitzy-badge-${size}`,
        {
          'blitzy-badge-interactive': !!onClick,
        },
        className
      )}
      onClick={onClick}
      role={role}
      aria-label={ariaLabel}
    >
      {children}
    </BlitzyUI.Box>
  );
};

// Named exports for component variants and sizes
export const BadgeVariants = ['success', 'warning', 'error', 'info', 'default'] as const;
export const BadgeSizes = ['sm', 'md', 'lg'] as const;

export default Badge;