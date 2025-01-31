// @blitzy/theme-engine v2.0.0 - Font configuration integration with Blitzy Theme Engine
import { memoize } from '@blitzy/theme-engine';

/**
 * Font configuration interface following Blitzy Enterprise Design System
 */
interface FontConfig {
  family: string;
  weights: Record<string, number>;
  fallbacks?: string[];
  preload?: boolean;
}

/**
 * System font stacks by operating system platform for optimal fallback rendering
 */
const SYSTEM_FONTS = {
  apple: '-apple-system, BlinkMacSystemFont',
  windows: 'Segoe UI',
  android: 'Roboto',
  linux: 'Ubuntu, Cantarell',
  fallback: 'sans-serif'
} as const;

/**
 * International font fallbacks for enhanced language support
 */
const INTERNATIONAL_FALLBACKS = [
  'Noto Sans',  // Google's font for all languages
  'Helvetica Neue',
  'Arial'
] as const;

/**
 * Primary font configuration for the enterprise platform
 * Uses Inter for optimal legibility and WCAG 2.1 compliance
 */
export const primaryFont: FontConfig = {
  family: 'Inter',
  weights: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700
  },
  preload: true
};

/**
 * Secondary font configuration for complementary UI elements
 * Uses SF Pro Display for enhanced visual hierarchy
 */
export const secondaryFont: FontConfig = {
  family: 'SF Pro Display',
  weights: {
    regular: 400,
    medium: 500,
    bold: 700
  },
  preload: true
};

/**
 * Generates an accessible and performant font stack with comprehensive fallbacks
 * @param fontFamily - Primary font family name
 * @returns Complete font stack string with system-specific and generic fallbacks
 */
@memoize
export const getFontStack = (fontFamily: string): string => {
  if (!fontFamily || typeof fontFamily !== 'string') {
    throw new Error('Invalid font family name provided');
  }

  const fallbackStack = [
    fontFamily,
    SYSTEM_FONTS.apple,
    SYSTEM_FONTS.windows,
    SYSTEM_FONTS.android,
    SYSTEM_FONTS.linux,
    ...INTERNATIONAL_FALLBACKS,
    SYSTEM_FONTS.fallback
  ];

  return fallbackStack
    .filter(Boolean)
    .map(font => (font.includes(' ') ? `"${font}"` : font))
    .join(', ');
};

/**
 * Combined font configuration for Blitzy Theme Engine integration
 * Exports complete typography configuration with fallbacks
 */
export const fontConfig = {
  primary: {
    ...primaryFont,
    fallbacks: [
      SYSTEM_FONTS.apple,
      SYSTEM_FONTS.windows,
      ...INTERNATIONAL_FALLBACKS
    ]
  },
  secondary: {
    ...secondaryFont,
    fallbacks: [
      SYSTEM_FONTS.apple,
      'Helvetica Neue',
      ...INTERNATIONAL_FALLBACKS
    ]
  }
} as const;

/**
 * Font weight constants for consistent typography across the platform
 */
export const fontWeights = {
  regular: primaryFont.weights.regular,
  medium: primaryFont.weights.medium,
  semibold: primaryFont.weights.semibold,
  bold: primaryFont.weights.bold
} as const;

/**
 * Default export for convenient font configuration access
 */
export default {
  primary: primaryFont,
  secondary: secondaryFont,
  getStack: getFontStack,
  weights: fontWeights,
  config: fontConfig
};