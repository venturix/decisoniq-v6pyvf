// @blitzy/auth v2.0.0 - Enterprise authentication configuration types
import type { BlitzyAuthConfig } from '@blitzy/auth';

/**
 * String literal union type for strict role-based access control
 * Defines the four distinct user roles in the system
 */
export enum UserRole {
  ADMIN = 'ADMIN',
  CS_MANAGER = 'CS_MANAGER',
  CS_REP = 'CS_REP',
  VIEWER = 'VIEWER'
}

/**
 * Immutable interface for authenticated user data with strict type safety
 * Contains core user information and security-related fields
 */
export interface User {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly roles: readonly UserRole[];
  readonly mfaEnabled: boolean;
  readonly lastLoginAt: string;
  readonly permissions: readonly string[];
  readonly sessionExpiry: number;
}

/**
 * Interface for email/password login with optional remember me flag
 * Used for traditional authentication flow
 */
export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * Immutable interface for SAML 2.0 SSO authentication payload
 * Implements enterprise SSO integration requirements
 */
export interface SSOPayload {
  readonly samlResponse: string;
  readonly relayState: string;
  readonly idpProvider: string;
}

/**
 * Immutable interface for JWT authentication tokens with strict typing
 * Implements secure token management for API authentication
 */
export interface AuthToken {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
  readonly tokenType: 'Bearer';
  readonly scope: string;
}

/**
 * Interface for multi-factor authentication verification with method support
 * Implements TOTP and SMS-based MFA requirements
 */
export interface MFAVerification {
  mfaCode: string;
  readonly tempToken: string;
  readonly method: 'TOTP' | 'SMS';
}

/**
 * Immutable interface for global authentication state management
 * Provides type-safe access to authentication context
 */
export interface AuthState {
  readonly isAuthenticated: boolean;
  readonly user: User | null;
  readonly token: AuthToken | null;
  readonly loading: boolean;
  readonly error: Error | null;
}