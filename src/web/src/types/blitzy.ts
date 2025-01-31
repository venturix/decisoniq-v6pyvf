// @ts-check
import { type ComponentType } from 'react'; // ^18.0.0

/**
 * Standard breakpoint values for responsive design
 */
export const BlitzyBreakpoints = {
  mobile: 320,
  tablet: 768,
  desktop: 1024,
  large: 1440,
} as const;

export type BlitzyBreakpoints = typeof BlitzyBreakpoints;

/**
 * Component variant options for consistent styling
 */
export type BlitzyVariants = 'primary' | 'secondary' | 'tertiary';

/**
 * Component size options for consistent scaling
 */
export type BlitzySizes = 'sm' | 'md' | 'lg';

/**
 * Supported page types in the Blitzy Page Builder
 */
export type BlitzyPageTypes = 'dashboard' | 'form' | 'list' | 'detail';

/**
 * Layout pattern options for page composition
 */
export type BlitzyLayoutPatterns = 'z-pattern' | 'f-pattern';

/**
 * Theme configuration interface for the Blitzy Theme Engine
 */
export interface BlitzyThemeConfig {
  /** Theme mode selection */
  mode: 'light' | 'dark' | 'high-contrast';
  /** Theme color palette */
  colors: Record<string, string>;
  /** Responsive breakpoints */
  breakpoints: Record<string, number>;
}

/**
 * Layout configuration interface for page structure
 */
export interface LayoutConfig {
  /** Layout pattern selection */
  pattern: BlitzyLayoutPatterns;
  /** Base grid configuration */
  grid: {
    columns: number;
    rows: number;
  };
  /** Responsive grid configurations */
  breakpoints: Record<keyof BlitzyBreakpoints, {
    columns: number;
    rows: number;
  }>;
}

/**
 * Page Builder configuration interface
 */
export interface BlitzyPageBuilderConfig {
  /** Theme configuration */
  theme: BlitzyThemeConfig;
  /** Registered components */
  components: Record<string, ComponentType>;
  /** Available layouts */
  layouts: Record<string, LayoutConfig>;
}

/**
 * Base props interface for Blitzy UI components
 */
export interface BlitzyComponentProps {
  /** Current theme configuration */
  theme: BlitzyThemeConfig;
  /** Optional CSS class name */
  className?: string;
  /** Component variant */
  variant?: BlitzyVariants;
  /** Component size */
  size?: BlitzySizes;
}

/**
 * Authentication configuration interface for Blitzy Enterprise SSO
 */
export interface BlitzyAuthConfig {
  /** Enable/disable SSO authentication */
  ssoEnabled: boolean;
  /** SAML endpoint URL */
  samlEndpoint: string;
  /** Enable/disable multi-factor authentication */
  mfaEnabled: boolean;
  /** Token refresh interval in milliseconds */
  tokenRefreshInterval: number;
}

/**
 * Theme context value interface for theme management
 */
export interface ThemeContextValue {
  /** Current theme configuration */
  theme: BlitzyThemeConfig;
  /** Theme update function */
  setTheme: (theme: BlitzyThemeConfig) => void;
}

// Type guard for checking valid breakpoint keys
export const isValidBreakpoint = (key: string): key is keyof BlitzyBreakpoints => {
  return key in BlitzyBreakpoints;
};

// Type guard for checking valid variants
export const isValidVariant = (variant: string): variant is BlitzyVariants => {
  return ['primary', 'secondary', 'tertiary'].includes(variant);
};

// Type guard for checking valid sizes
export const isValidSize = (size: string): size is BlitzySizes => {
  return ['sm', 'md', 'lg'].includes(size);
};