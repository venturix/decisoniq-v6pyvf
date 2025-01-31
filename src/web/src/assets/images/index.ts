// @ts-check
import { type ReactNode } from 'react';

/**
 * @version 1.0.0
 * Image asset types supported by the Customer Success AI Platform
 */
export type ImageAssetType = 'logo' | 'icon' | 'illustration' | 'background';

/**
 * @version 1.0.0
 * Theme variants supported by Blitzy Theme Engine
 */
export type ThemeVariant = 'light' | 'dark' | 'high-contrast';

/**
 * @version 1.0.0
 * Interface for image asset metadata following Blitzy Enterprise Design System
 */
export interface ImageAsset {
  path: string;
  type: ImageAssetType;
  themeVariants?: Record<ThemeVariant, string>;
}

// Company logos with theme variants
export const logoLight = '/assets/images/logo/cs-platform-logo-light.svg';
export const logoDark = '/assets/images/logo/cs-platform-logo-dark.svg';
export const logoHighContrast = '/assets/images/logo/cs-platform-logo-hc.svg';

// Dashboard illustrations following Blitzy Premium UI guidelines
export const dashboardIllustrations = {
  customerHealth: '/assets/images/illustrations/customer-health.svg',
  riskAssessment: '/assets/images/illustrations/risk-assessment.svg',
  revenueImpact: '/assets/images/illustrations/revenue-impact.svg',
} as const;

// Empty state illustrations for CS-specific widgets
export const emptyStateImages = {
  noCustomers: '/assets/images/empty-states/no-customers.svg',
  noPlaybooks: '/assets/images/empty-states/no-playbooks.svg',
  noTasks: '/assets/images/empty-states/no-tasks.svg',
} as const;

// Background patterns for different sections
export const backgroundPatterns = {
  login: '/assets/images/patterns/login-bg.svg',
  dashboard: '/assets/images/patterns/dashboard-bg.svg',
} as const;

// Icon sets with theme variants
export const icons = {
  navigation: {
    dashboard: {
      light: '/assets/images/icons/light/dashboard.svg',
      dark: '/assets/images/icons/dark/dashboard.svg',
      'high-contrast': '/assets/images/icons/hc/dashboard.svg',
    },
    customers: {
      light: '/assets/images/icons/light/customers.svg',
      dark: '/assets/images/icons/dark/customers.svg',
      'high-contrast': '/assets/images/icons/hc/customers.svg',
    },
    playbooks: {
      light: '/assets/images/icons/light/playbooks.svg',
      dark: '/assets/images/icons/dark/playbooks.svg',
      'high-contrast': '/assets/images/icons/hc/playbooks.svg',
    },
    analytics: {
      light: '/assets/images/icons/light/analytics.svg',
      dark: '/assets/images/icons/dark/analytics.svg',
      'high-contrast': '/assets/images/icons/hc/analytics.svg',
    },
  },
} as const;

/**
 * Helper function to get theme-appropriate image variant
 * @param name - Asset name to retrieve
 * @param theme - Current theme variant
 * @returns Path to theme-appropriate image asset
 */
export const getThemedImage = (name: string, theme: ThemeVariant): string => {
  const assetMap: Record<string, Record<ThemeVariant, string>> = {
    logo: {
      light: logoLight,
      dark: logoDark,
      'high-contrast': logoHighContrast,
    },
    ...icons.navigation,
  };

  return assetMap[name]?.[theme] ?? assetMap[name]?.light ?? '';
};

// Export image asset metadata for type checking
export const imageAssets: Record<string, ImageAsset> = {
  logo: {
    path: logoLight,
    type: 'logo',
    themeVariants: {
      light: logoLight,
      dark: logoDark,
      'high-contrast': logoHighContrast,
    },
  },
  customerHealth: {
    path: dashboardIllustrations.customerHealth,
    type: 'illustration',
  },
  riskAssessment: {
    path: dashboardIllustrations.riskAssessment,
    type: 'illustration',
  },
  revenueImpact: {
    path: dashboardIllustrations.revenueImpact,
    type: 'illustration',
  },
  loginBackground: {
    path: backgroundPatterns.login,
    type: 'background',
  },
  dashboardBackground: {
    path: backgroundPatterns.dashboard,
    type: 'background',
  },
} as const;

export default imageAssets;