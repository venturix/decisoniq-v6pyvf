/**
 * Core configuration constants for the Customer Success AI Platform frontend application.
 * @version 1.0.0
 */

/**
 * Core application configuration settings including API, localization, and session management
 */
export const APP_CONFIG = {
  /** Application name */
  APP_NAME: 'Customer Success AI Platform',
  /** Application version */
  APP_VERSION: '1.0.0',
  /** API request timeout in milliseconds */
  API_TIMEOUT: 30000,
  /** Number of API retry attempts before failure */
  API_RETRY_ATTEMPTS: 3,
  /** Base URL for API endpoints */
  API_BASE_URL: process.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1',
  /** Default application locale */
  DEFAULT_LOCALE: 'en',
  /** Session timeout in seconds (1 hour) */
  SESSION_TIMEOUT: 3600,
  /** Token refresh interval in seconds (5 minutes) */
  TOKEN_REFRESH_INTERVAL: 300,
} as const;

/**
 * Responsive design breakpoints in pixels for consistent layout adaptation
 * Based on technical specifications for UI design requirements
 */
export const BREAKPOINTS = {
  /** Mobile breakpoint (320px) */
  MOBILE: 320,
  /** Tablet breakpoint (768px) */
  TABLET: 768,
  /** Desktop breakpoint (1024px) */
  DESKTOP: 1024,
  /** Large desktop breakpoint (1440px) */
  LARGE: 1440,
} as const;

/**
 * Feature flag configurations for controlling feature availability
 * Enables granular control over system capabilities
 */
export const FEATURE_FLAGS = {
  /** Enable ML-based predictions functionality */
  ENABLE_ML_PREDICTIONS: true,
  /** Enable automated playbook execution */
  ENABLE_PLAYBOOK_AUTOMATION: true,
  /** Enable real-time data updates */
  ENABLE_REAL_TIME_UPDATES: true,
  /** Enable Multi-Factor Authentication */
  ENABLE_MFA: true,
  /** Enable Single Sign-On authentication */
  ENABLE_SSO: true,
} as const;

/**
 * Performance monitoring thresholds for system optimization
 * Based on technical specifications for system performance requirements
 */
export const PERFORMANCE_THRESHOLDS = {
  /** Maximum acceptable API response time in milliseconds */
  API_RESPONSE_TIME: 3000,
  /** Maximum acceptable page load time in milliseconds */
  PAGE_LOAD_TIME: 2000,
  /** Maximum acceptable prediction computation time in milliseconds */
  PREDICTION_TIME: 3000,
  /** Cache Time-To-Live in seconds */
  CACHE_TTL: 300,
} as const;

// Type definitions for exported constants
export type AppConfig = typeof APP_CONFIG;
export type Breakpoints = typeof BREAKPOINTS;
export type FeatureFlags = typeof FEATURE_FLAGS;
export type PerformanceThresholds = typeof PERFORMANCE_THRESHOLDS;