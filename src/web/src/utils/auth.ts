import { BlitzyAuth } from '@blitzy/auth'; // v2.0.0
import jwtDecode from 'jwt-decode'; // v4.0.0
import EventEmitter from 'eventemitter3'; // v5.0.0
import AES from 'crypto-js/aes'; // v4.2.0

import type { 
  User, 
  AuthToken, 
  LoginCredentials, 
  SSOPayload, 
  MFAVerification,
  UserRole 
} from '../types/auth';
import { storage, StorageKeys } from './storage';
import { APP_CONFIG, FEATURE_FLAGS } from '../config/constants';

// Authentication event types for state management
export const AUTH_EVENT_TYPES = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  TOKEN_REFRESH: 'tokenRefresh',
  MFA_REQUIRED: 'mfaRequired',
  SESSION_EXPIRED: 'sessionExpired',
  ERROR: 'error'
} as const;

// Token refresh configuration
const TOKEN_REFRESH_BUFFER = 5 * 60 * 1000; // 5 minutes before expiry
const MAX_REFRESH_RETRIES = 3;
const REFRESH_BACKOFF_BASE = 2000; // Base delay for exponential backoff

// Initialize event emitter for auth state changes
export const authEventEmitter = new EventEmitter();

// Initialize Blitzy Auth client with enterprise configuration
const blitzyAuthClient = new BlitzyAuth({
  clientId: process.env.VITE_BLITZY_CLIENT_ID!,
  tenantId: process.env.VITE_BLITZY_TENANT_ID!,
  redirectUri: `${window.location.origin}/auth/callback`,
  postLogoutRedirectUri: window.location.origin,
  samlEndpoint: process.env.VITE_SAML_ENDPOINT,
  mfaEnabled: FEATURE_FLAGS.ENABLE_MFA,
  ssoEnabled: FEATURE_FLAGS.ENABLE_SSO,
  sessionTimeout: APP_CONFIG.SESSION_TIMEOUT,
  tokenRefreshInterval: APP_CONFIG.TOKEN_REFRESH_INTERVAL
});

// Token refresh timer reference
let refreshTokenTimer: number | null = null;

/**
 * Validates JWT token structure and expiration
 * @param token - JWT token to validate
 * @returns boolean indicating token validity
 */
const validateToken = (token: string): boolean => {
  try {
    const decoded = jwtDecode<{ exp: number }>(token);
    const currentTime = Date.now() / 1000;
    return decoded.exp > currentTime;
  } catch {
    return false;
  }
};

/**
 * Sets up token refresh timer with exponential backoff
 * @param expiresIn - Token expiration time in seconds
 * @param retryCount - Current retry attempt count
 */
const setupTokenRefresh = (expiresIn: number, retryCount = 0) => {
  if (refreshTokenTimer) {
    window.clearTimeout(refreshTokenTimer);
  }

  const refreshTime = (expiresIn * 1000) - TOKEN_REFRESH_BUFFER;
  const backoffDelay = retryCount ? REFRESH_BACKOFF_BASE * Math.pow(2, retryCount - 1) : 0;

  refreshTokenTimer = window.setTimeout(async () => {
    try {
      const currentToken = storage.getItem<AuthToken>(StorageKeys.AUTH_TOKEN, true);
      if (!currentToken?.refreshToken) throw new Error('No refresh token available');

      const newToken = await blitzyAuthClient.refreshToken(currentToken.refreshToken);
      await handleTokenUpdate(newToken);
      authEventEmitter.emit(AUTH_EVENT_TYPES.TOKEN_REFRESH, { success: true });
      
      // Reset refresh cycle with new token
      setupTokenRefresh(newToken.expiresIn);
    } catch (error) {
      if (retryCount < MAX_REFRESH_RETRIES) {
        setupTokenRefresh(expiresIn, retryCount + 1);
      } else {
        handleLogout();
        authEventEmitter.emit(AUTH_EVENT_TYPES.SESSION_EXPIRED);
      }
    }
  }, refreshTime + backoffDelay);
};

/**
 * Updates token in secure storage and initializes refresh timer
 * @param token - New authentication token
 */
const handleTokenUpdate = async (token: AuthToken): Promise<void> => {
  try {
    await storage.setItem(StorageKeys.AUTH_TOKEN, token, true);
    setupTokenRefresh(token.expiresIn);
  } catch (error) {
    throw new Error(`Failed to update token: ${error}`);
  }
};

/**
 * Initializes authentication state and validates existing session
 * @returns Promise resolving when initialization complete
 */
export const initializeAuth = async (): Promise<void> => {
  try {
    const storedToken = storage.getItem<AuthToken>(StorageKeys.AUTH_TOKEN, true);
    
    if (storedToken && validateToken(storedToken.accessToken)) {
      await blitzyAuthClient.initialize();
      await handleTokenUpdate(storedToken);
      
      const user = await blitzyAuthClient.getUserInfo(storedToken.accessToken);
      authEventEmitter.emit(AUTH_EVENT_TYPES.LOGIN, { user });
    }
  } catch (error) {
    handleLogout();
    throw new Error(`Auth initialization failed: ${error}`);
  }
};

/**
 * Handles user login with support for SSO and MFA
 * @param credentials - Login credentials or SSO payload
 * @returns Promise resolving to authenticated user
 */
export const handleLogin = async (
  credentials: LoginCredentials | SSOPayload
): Promise<User> => {
  try {
    const authResponse = 'samlResponse' in credentials
      ? await blitzyAuthClient.handleSSOLogin(credentials)
      : await blitzyAuthClient.login(credentials);

    if (authResponse.requiresMFA) {
      authEventEmitter.emit(AUTH_EVENT_TYPES.MFA_REQUIRED, { tempToken: authResponse.tempToken });
      throw new Error('MFA_REQUIRED');
    }

    await handleTokenUpdate(authResponse.token);
    const user = await blitzyAuthClient.getUserInfo(authResponse.token.accessToken);
    authEventEmitter.emit(AUTH_EVENT_TYPES.LOGIN, { user });
    
    return user;
  } catch (error) {
    if ((error as Error).message !== 'MFA_REQUIRED') {
      authEventEmitter.emit(AUTH_EVENT_TYPES.ERROR, { error });
    }
    throw error;
  }
};

/**
 * Handles MFA verification during login process
 * @param verification - MFA verification details
 * @returns Promise resolving to authenticated user
 */
export const handleMFAVerification = async (
  verification: MFAVerification
): Promise<User> => {
  try {
    const authResponse = await blitzyAuthClient.verifyMFA(verification);
    await handleTokenUpdate(authResponse.token);
    
    const user = await blitzyAuthClient.getUserInfo(authResponse.token.accessToken);
    authEventEmitter.emit(AUTH_EVENT_TYPES.LOGIN, { user });
    
    return user;
  } catch (error) {
    authEventEmitter.emit(AUTH_EVENT_TYPES.ERROR, { error });
    throw error;
  }
};

/**
 * Handles user logout and session cleanup
 */
export const handleLogout = async (): Promise<void> => {
  try {
    if (refreshTokenTimer) {
      window.clearTimeout(refreshTokenTimer);
      refreshTokenTimer = null;
    }
    
    await blitzyAuthClient.logout();
    storage.removeItem(StorageKeys.AUTH_TOKEN);
    authEventEmitter.emit(AUTH_EVENT_TYPES.LOGOUT);
  } catch (error) {
    console.error('Logout error:', error);
    // Force cleanup even if logout fails
    storage.removeItem(StorageKeys.AUTH_TOKEN);
    authEventEmitter.emit(AUTH_EVENT_TYPES.LOGOUT);
  }
};

/**
 * Checks if user has required role for access control
 * @param requiredRole - Role required for access
 * @param userRoles - User's assigned roles
 * @returns boolean indicating if user has required role
 */
export const hasRequiredRole = (requiredRole: UserRole, userRoles: UserRole[]): boolean => {
  const roleHierarchy: Record<UserRole, number> = {
    [UserRole.ADMIN]: 4,
    [UserRole.CS_MANAGER]: 3,
    [UserRole.CS_REP]: 2,
    [UserRole.VIEWER]: 1
  };

  const requiredLevel = roleHierarchy[requiredRole];
  return userRoles.some(role => roleHierarchy[role] >= requiredLevel);
};