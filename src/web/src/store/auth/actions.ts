// @blitzy/auth v2.0.0 - Redux action creators for enterprise authentication
import { ThunkAction } from 'redux-thunk'; // v2.4.2
import { Dispatch } from 'redux'; // v4.2.0
import { AuthError } from '@types/auth-errors'; // v1.0.0
import { AuditLogger } from '@blitzy/logging'; // v1.0.0

import { AuthActionTypes } from './types';
import type {
  LoginCredentials,
  SSOPayload,
  User,
  AuthToken,
  AuthState
} from '../../types/auth';

// Initialize audit logger for security tracking
const auditLogger = new AuditLogger({
  service: 'authentication',
  version: '2.0.0'
});

// Rate limiting configuration
const LOGIN_ATTEMPT_LIMIT = 5;
const LOGIN_ATTEMPT_WINDOW = 300000; // 5 minutes
const loginAttempts = new Map<string, number[]>();

/**
 * Checks if login attempts are within rate limits
 * @param email User email for rate limiting
 */
const checkRateLimit = (email: string): boolean => {
  const now = Date.now();
  const attempts = loginAttempts.get(email) || [];
  const recentAttempts = attempts.filter(time => now - time < LOGIN_ATTEMPT_WINDOW);
  
  loginAttempts.set(email, [...recentAttempts, now]);
  return recentAttempts.length < LOGIN_ATTEMPT_LIMIT;
};

/**
 * Creates a thunk action for user login with comprehensive security controls
 * @param credentials User login credentials
 */
export const loginRequest = (
  credentials: LoginCredentials
): ThunkAction<Promise<void>, AuthState, unknown, any> => {
  return async (dispatch: Dispatch) => {
    try {
      // Check rate limiting
      if (!checkRateLimit(credentials.email)) {
        throw new AuthError('TOO_MANY_ATTEMPTS');
      }

      dispatch({ type: AuthActionTypes.LOGIN_REQUEST });

      // Log authentication attempt
      await auditLogger.log({
        action: 'LOGIN_ATTEMPT',
        user: credentials.email,
        metadata: { rememberMe: credentials.rememberMe }
      });

      // Call authentication API
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.REACT_APP_API_KEY
        },
        body: JSON.stringify(credentials)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new AuthError(data.error);
      }

      // Handle MFA challenge if required
      if (data.mfaRequired) {
        dispatch({
          type: AuthActionTypes.MFA_REQUIRED,
          payload: {
            tempToken: data.tempToken,
            method: data.mfaMethod
          }
        });
        return;
      }

      // Process successful login
      const { user, token } = data;
      dispatch({
        type: AuthActionTypes.LOGIN_SUCCESS,
        payload: { user, token }
      });

      // Set up token refresh timer
      setupTokenRefresh(token, dispatch);

      // Log successful authentication
      await auditLogger.log({
        action: 'LOGIN_SUCCESS',
        user: user.id,
        metadata: { roles: user.roles }
      });

    } catch (error) {
      dispatch({
        type: AuthActionTypes.LOGIN_FAILURE,
        error: error.message
      });

      // Log authentication failure
      await auditLogger.log({
        action: 'LOGIN_FAILURE',
        user: credentials.email,
        error: error.message
      });

      throw error;
    }
  };
};

/**
 * Creates a thunk action for SSO authentication with SAML validation
 * @param ssoPayload SAML response payload
 */
export const ssoLoginRequest = (
  ssoPayload: SSOPayload
): ThunkAction<Promise<void>, AuthState, unknown, any> => {
  return async (dispatch: Dispatch) => {
    try {
      dispatch({ type: AuthActionTypes.SSO_LOGIN_REQUEST });

      // Log SSO attempt
      await auditLogger.log({
        action: 'SSO_LOGIN_ATTEMPT',
        metadata: { idpProvider: ssoPayload.idpProvider }
      });

      // Call SSO authentication API
      const response = await fetch('/api/v1/auth/sso', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.REACT_APP_API_KEY
        },
        body: JSON.stringify(ssoPayload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new AuthError(data.error);
      }

      // Handle MFA if required by policy
      if (data.mfaRequired) {
        dispatch({
          type: AuthActionTypes.MFA_REQUIRED,
          payload: {
            tempToken: data.tempToken,
            method: data.mfaMethod
          }
        });
        return;
      }

      // Process successful SSO login
      const { user, token } = data;
      dispatch({
        type: AuthActionTypes.LOGIN_SUCCESS,
        payload: { user, token }
      });

      // Set up token refresh timer
      setupTokenRefresh(token, dispatch);

      // Log successful SSO authentication
      await auditLogger.log({
        action: 'SSO_LOGIN_SUCCESS',
        user: user.id,
        metadata: { 
          idpProvider: ssoPayload.idpProvider,
          roles: user.roles
        }
      });

    } catch (error) {
      dispatch({
        type: AuthActionTypes.SSO_LOGIN_FAILURE,
        error: error.message
      });

      // Log SSO failure
      await auditLogger.log({
        action: 'SSO_LOGIN_FAILURE',
        error: error.message,
        metadata: { idpProvider: ssoPayload.idpProvider }
      });

      throw error;
    }
  };
};

/**
 * Creates a thunk action for secure token refresh
 * @param refreshToken Current refresh token
 */
export const refreshTokenRequest = (
  refreshToken: string
): ThunkAction<Promise<void>, AuthState, unknown, any> => {
  return async (dispatch: Dispatch) => {
    try {
      dispatch({ type: AuthActionTypes.REFRESH_TOKEN });

      // Call token refresh API
      const response = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.REACT_APP_API_KEY
        },
        body: JSON.stringify({ refreshToken })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new AuthError(data.error);
      }

      dispatch({
        type: AuthActionTypes.REFRESH_TOKEN_SUCCESS,
        payload: data.token
      });

      // Set up new refresh timer
      setupTokenRefresh(data.token, dispatch);

      // Log token refresh
      await auditLogger.log({
        action: 'TOKEN_REFRESH_SUCCESS'
      });

    } catch (error) {
      dispatch({
        type: AuthActionTypes.REFRESH_TOKEN_FAILURE,
        error: error.message
      });

      // Log refresh failure
      await auditLogger.log({
        action: 'TOKEN_REFRESH_FAILURE',
        error: error.message
      });

      // Handle expired session
      dispatch({ type: AuthActionTypes.SESSION_EXPIRED });
      throw error;
    }
  };
};

/**
 * Sets up automatic token refresh before expiration
 * @param token Current auth token
 * @param dispatch Redux dispatch function
 */
const setupTokenRefresh = (token: AuthToken, dispatch: Dispatch): void => {
  const refreshBuffer = 60000; // 1 minute before expiry
  const refreshTime = (token.expiresIn * 1000) - refreshBuffer;

  setTimeout(() => {
    dispatch(refreshTokenRequest(token.refreshToken));
  }, refreshTime);
};

/**
 * Creates an action to handle user logout
 */
export const logout = () => ({
  type: AuthActionTypes.LOGOUT
});