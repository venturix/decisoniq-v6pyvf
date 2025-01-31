/**
 * Authentication configuration for the Customer Success AI Platform frontend
 * Implements enterprise-grade security with Blitzy SSO integration
 * @version 1.0.0
 * @blitzy/auth ^2.0.0
 */

import type { BlitzyAuthConfig } from '@blitzy/auth'; // ^2.0.0
import { APP_CONFIG } from './constants';
import { UserRole } from '../types/auth';

/**
 * Core authentication configuration for Blitzy Enterprise integration
 * Implements SAML 2.0 SSO, MFA, and secure session management
 */
export const AUTH_CONFIG: BlitzyAuthConfig = {
  // SSO Configuration
  ssoEnabled: true,
  samlEndpoint: process.env.VITE_BLITZY_SSO_ENDPOINT,
  mfaEnabled: true,
  
  // Session Management
  sessionTimeout: APP_CONFIG.SESSION_TIMEOUT,
  tokenRefreshInterval: APP_CONFIG.TOKEN_REFRESH_INTERVAL,
  
  // Identity Provider Configuration
  idpMetadataUrl: process.env.VITE_BLITZY_IDP_METADATA_URL,
  clientId: process.env.VITE_BLITZY_CLIENT_ID,
  clientSecret: process.env.VITE_BLITZY_CLIENT_SECRET,

  // Security Settings
  securityLevel: 'high',
  tokenValidation: 'strict',
  sessionInactivityTimeout: 900000, // 15 minutes
  maxFailedAttempts: 3,
  lockoutDuration: 900000, // 15 minutes
} as const;

/**
 * Role-based access control permissions matrix
 * Defines granular permissions for each user role
 */
export const ROLE_PERMISSIONS = {
  [UserRole.ADMIN]: {
    canManageUsers: true,
    canManagePlaybooks: true,
    canViewAnalytics: true,
    canManageIntegrations: true,
    canConfigureSystem: true,
    canManageRoles: true,
    canAuditSystem: true,
  },
  
  [UserRole.CS_MANAGER]: {
    canManagePlaybooks: true,
    canViewAnalytics: true,
    canManageTeam: true,
    canViewReports: true,
    canManageCustomers: true,
    canConfigureAlerts: true,
  },
  
  [UserRole.CS_REP]: {
    canExecutePlaybooks: true,
    canViewCustomers: true,
    canViewAnalytics: true,
    canManageAssignedAccounts: true,
    canCreateTasks: true,
  },
  
  [UserRole.VIEWER]: {
    canViewCustomers: true,
    canViewAnalytics: true,
    canViewReports: true,
    canExportData: false,
  },
} as const;

/**
 * Validates authentication configuration and security parameters
 * @throws {Error} If configuration is invalid or insecure
 * @returns {boolean} True if configuration is valid
 */
export function validateAuthConfig(): boolean {
  // Verify required environment variables
  if (!process.env.VITE_BLITZY_SSO_ENDPOINT || 
      !process.env.VITE_BLITZY_IDP_METADATA_URL ||
      !process.env.VITE_BLITZY_CLIENT_ID ||
      !process.env.VITE_BLITZY_CLIENT_SECRET) {
    throw new Error('Missing required authentication environment variables');
  }

  // Validate SSO endpoint URL format
  try {
    new URL(process.env.VITE_BLITZY_SSO_ENDPOINT);
    new URL(process.env.VITE_BLITZY_IDP_METADATA_URL);
  } catch {
    throw new Error('Invalid SSO endpoint or IDP metadata URL format');
  }

  // Validate session timeout values
  if (AUTH_CONFIG.sessionTimeout < 300 || AUTH_CONFIG.sessionTimeout > 86400) {
    throw new Error('Session timeout must be between 5 minutes and 24 hours');
  }

  // Validate token refresh interval
  if (AUTH_CONFIG.tokenRefreshInterval < 60 || 
      AUTH_CONFIG.tokenRefreshInterval > AUTH_CONFIG.sessionTimeout) {
    throw new Error('Invalid token refresh interval');
  }

  // Validate security settings
  if (AUTH_CONFIG.securityLevel !== 'high' || 
      AUTH_CONFIG.tokenValidation !== 'strict') {
    throw new Error('Invalid security configuration');
  }

  return true;
}