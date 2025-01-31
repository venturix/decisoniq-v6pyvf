import React, { type ComponentType, useMemo, memo } from 'react'; // ^18.0.0
import { BlitzyUI } from '@blitzy/premium-ui'; // ^2.0.0
import classNames from 'classnames'; // ^2.3.0
import { type BlitzyThemeConfig } from '../../types/blitzy';
import { useTheme } from './theme';

// UI Component Variants
const UI_VARIANTS = ['primary', 'secondary', 'tertiary', 'danger', 'ghost'] as const;
type UIVariant = typeof UI_VARIANTS[number];

// UI Component Sizes
const UI_SIZES = ['sm', 'md', 'lg'] as const;
type UISize = typeof UI_SIZES[number];

// Theme Classes
const THEME_CLASSES = {
  light: 'blitzy-theme-light',
  dark: 'blitzy-theme-dark',
  'high-contrast': 'blitzy-theme-hc',
  system: 'blitzy-theme-system'
} as const;

// Theme Transition Classes
const TRANSITION_CLASSES = {
  entering: 'theme-transition-enter',
  active: 'theme-transition-active'
} as const;

// Base Props Interface
interface BaseProps {
  className?: string;
  children?: React.ReactNode;
  'aria-label'?: string;
  role?: string;
}

// Button Props Interface
interface ButtonProps extends BaseProps {
  variant?: UIVariant;
  size?: UISize;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  aria?: Record<string, string>;
}

// Card Props Interface
interface CardProps extends BaseProps {
  variant?: 'default' | 'elevated' | 'outlined';
  interactive?: boolean;
}

// Theme Options Interface
interface ThemeOptions {
  transitions?: boolean;
  highContrast?: boolean;
  systemPreference?: boolean;
}

/**
 * Enhanced Button component with WCAG 2.1 Level AA compliance
 */
export const Button = memo<ButtonProps>(({
  variant = 'primary',
  size = 'md',
  className,
  children,
  disabled,
  onClick,
  type = 'button',
  aria,
  ...props
}) => {
  const { theme } = useTheme();
  
  const buttonClasses = useMemo(() => classNames(
    'blitzy-button',
    `blitzy-button-${variant}`,
    `blitzy-button-${size}`,
    {
      'blitzy-button-disabled': disabled,
      'high-contrast': theme.mode === 'high-contrast'
    },
    className
  ), [variant, size, disabled, theme.mode, className]);

  const ariaProps = {
    role: 'button',
    'aria-disabled': disabled,
    ...aria
  };

  return (
    <BlitzyUI.Button
      className={buttonClasses}
      onClick={!disabled ? onClick : undefined}
      type={type}
      {...ariaProps}
      {...props}
    >
      {children}
    </BlitzyUI.Button>
  );
});

Button.displayName = 'Button';

/**
 * Enhanced Card component with theme support and accessibility features
 */
export const Card = memo<CardProps>(({
  variant = 'default',
  className,
  children,
  interactive,
  role = 'region',
  ...props
}) => {
  const { theme } = useTheme();

  const cardClasses = useMemo(() => classNames(
    'blitzy-card',
    `blitzy-card-${variant}`,
    {
      'blitzy-card-interactive': interactive,
      'high-contrast': theme.mode === 'high-contrast'
    },
    className
  ), [variant, interactive, theme.mode, className]);

  return (
    <BlitzyUI.Card
      className={cardClasses}
      role={role}
      tabIndex={interactive ? 0 : undefined}
      {...props}
    >
      {children}
    </BlitzyUI.Card>
  );
});

Card.displayName = 'Card';

/**
 * Enhanced theme application utility with transition and accessibility support
 */
export const applyTheme = <P extends object>(
  Component: ComponentType<P>,
  theme: BlitzyThemeConfig,
  options: ThemeOptions = {}
): ComponentType<P> => {
  const ThemedComponent = memo((props: P) => {
    const { transitions = true, highContrast = false } = options;
    
    const themeClasses = useMemo(() => getThemeClasses(theme, transitions), [theme, transitions]);
    
    const componentProps = {
      ...props,
      className: classNames(
        themeClasses,
        { 'high-contrast': highContrast || theme.mode === 'high-contrast' },
        (props as any).className
      ),
      'data-theme': theme.mode,
      style: {
        ...((props as any).style || {}),
        ...getThemeColorVariables(theme)
      }
    };

    return <Component {...componentProps} />;
  });

  ThemedComponent.displayName = `Themed(${Component.displayName || Component.name || 'Component'})`;
  return ThemedComponent;
};

/**
 * Generates theme-specific CSS class names with transition support
 */
const getThemeClasses = (theme: BlitzyThemeConfig, withTransitions: boolean): string => {
  const classes = [THEME_CLASSES[theme.mode]];
  
  if (withTransitions) {
    classes.push(TRANSITION_CLASSES.entering, TRANSITION_CLASSES.active);
  }
  
  return classNames(classes);
};

/**
 * Generates CSS custom properties for theme colors
 */
const getThemeColorVariables = (theme: BlitzyThemeConfig): Record<string, string> => {
  return Object.entries(theme.colors).reduce((vars, [key, value]) => ({
    ...vars,
    [`--blitzy-${key}`]: value
  }), {});
};

// Export type definitions for external use
export type {
  UIVariant,
  UISize,
  ButtonProps,
  CardProps,
  ThemeOptions
};