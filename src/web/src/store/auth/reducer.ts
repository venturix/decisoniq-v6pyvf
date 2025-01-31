// @blitzy/auth v2.0.0 - Enterprise authentication reducer
import { createReducer } from '@reduxjs/toolkit'; // v1.9.0
import { AuthActionTypes, AuthAction } from './types';
import { User } from '../../types/auth';

/**
 * Interface for authentication state with strict immutability
 */
interface AuthState {
  readonly user: User | null;
  readonly isAuthenticated: boolean;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly mfaRequired: boolean;
  readonly tempToken: string | null;
  readonly sessionExpiry: number | null;
  readonly refreshToken: string | null;
  readonly lastActivity: number | null;
  readonly auditLog: ReadonlyArray<{
    event: string;
    timestamp: number;
    details?: unknown;
  }>;
}

/**
 * Initial authentication state with secure defaults
 */
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  mfaRequired: false,
  tempToken: null,
  sessionExpiry: null,
  refreshToken: null,
  lastActivity: null,
  auditLog: []
};

/**
 * Type-safe authentication reducer with immutable state updates
 * Implements enterprise security requirements for state transitions
 */
const authReducer = createReducer(initialState, (builder) => {
  builder
    // Handle standard login flow
    .addCase(AuthActionTypes.LOGIN_REQUEST, (state) => ({
      ...state,
      isLoading: true,
      error: null,
      auditLog: [...state.auditLog, {
        event: 'LOGIN_ATTEMPT',
        timestamp: Date.now()
      }]
    }))
    .addCase(AuthActionTypes.LOGIN_SUCCESS, (state, action) => ({
      ...state,
      isAuthenticated: true,
      isLoading: false,
      user: action.payload.user,
      sessionExpiry: Date.now() + (8 * 60 * 60 * 1000), // 8 hour session
      refreshToken: action.payload.token.refreshToken,
      lastActivity: Date.now(),
      error: null,
      auditLog: [...state.auditLog, {
        event: 'LOGIN_SUCCESS',
        timestamp: Date.now(),
        details: { userId: action.payload.user.id }
      }]
    }))
    .addCase(AuthActionTypes.LOGIN_FAILURE, (state, action) => ({
      ...state,
      isLoading: false,
      error: action.error,
      auditLog: [...state.auditLog, {
        event: 'LOGIN_FAILURE',
        timestamp: Date.now(),
        details: { error: action.error }
      }]
    }))

    // Handle SSO authentication
    .addCase(AuthActionTypes.SSO_LOGIN_REQUEST, (state) => ({
      ...state,
      isLoading: true,
      error: null,
      auditLog: [...state.auditLog, {
        event: 'SSO_LOGIN_ATTEMPT',
        timestamp: Date.now()
      }]
    }))
    .addCase(AuthActionTypes.SSO_LOGIN_SUCCESS, (state, action) => ({
      ...state,
      isAuthenticated: true,
      isLoading: false,
      user: action.payload.user,
      sessionExpiry: Date.now() + (12 * 60 * 60 * 1000), // 12 hour SSO session
      refreshToken: action.payload.token.refreshToken,
      lastActivity: Date.now(),
      error: null,
      auditLog: [...state.auditLog, {
        event: 'SSO_LOGIN_SUCCESS',
        timestamp: Date.now(),
        details: { 
          userId: action.payload.user.id,
          ssoProvider: action.payload.user.ssoProvider
        }
      }]
    }))
    .addCase(AuthActionTypes.SSO_LOGIN_FAILURE, (state, action) => ({
      ...state,
      isLoading: false,
      error: action.error,
      auditLog: [...state.auditLog, {
        event: 'SSO_LOGIN_FAILURE',
        timestamp: Date.now(),
        details: { error: action.error }
      }]
    }))

    // Handle MFA flow
    .addCase(AuthActionTypes.MFA_REQUIRED, (state, action) => ({
      ...state,
      mfaRequired: true,
      tempToken: action.payload.tempToken,
      auditLog: [...state.auditLog, {
        event: 'MFA_REQUIRED',
        timestamp: Date.now()
      }]
    }))
    .addCase(AuthActionTypes.MFA_SUCCESS, (state, action) => ({
      ...state,
      isAuthenticated: true,
      mfaRequired: false,
      tempToken: null,
      user: action.payload.user,
      sessionExpiry: Date.now() + (8 * 60 * 60 * 1000),
      refreshToken: action.payload.token.refreshToken,
      lastActivity: Date.now(),
      auditLog: [...state.auditLog, {
        event: 'MFA_SUCCESS',
        timestamp: Date.now(),
        details: { userId: action.payload.user.id }
      }]
    }))
    .addCase(AuthActionTypes.MFA_FAILURE, (state, action) => ({
      ...state,
      error: action.error,
      auditLog: [...state.auditLog, {
        event: 'MFA_FAILURE',
        timestamp: Date.now(),
        details: { error: action.error }
      }]
    }))

    // Handle session management
    .addCase(AuthActionTypes.SESSION_EXPIRED, (state) => ({
      ...state,
      isAuthenticated: false,
      user: null,
      sessionExpiry: null,
      refreshToken: null,
      auditLog: [...state.auditLog, {
        event: 'SESSION_EXPIRED',
        timestamp: Date.now()
      }]
    }))
    .addCase(AuthActionTypes.TOKEN_REFRESH_REQUEST, (state) => ({
      ...state,
      isLoading: true,
      auditLog: [...state.auditLog, {
        event: 'TOKEN_REFRESH_ATTEMPT',
        timestamp: Date.now()
      }]
    }))
    .addCase(AuthActionTypes.TOKEN_REFRESH_SUCCESS, (state, action) => ({
      ...state,
      isLoading: false,
      sessionExpiry: Date.now() + (8 * 60 * 60 * 1000),
      refreshToken: action.payload.refreshToken,
      lastActivity: Date.now(),
      auditLog: [...state.auditLog, {
        event: 'TOKEN_REFRESH_SUCCESS',
        timestamp: Date.now()
      }]
    }))
    .addCase(AuthActionTypes.TOKEN_REFRESH_FAILURE, (state, action) => ({
      ...state,
      isAuthenticated: false,
      isLoading: false,
      user: null,
      sessionExpiry: null,
      refreshToken: null,
      error: action.error,
      auditLog: [...state.auditLog, {
        event: 'TOKEN_REFRESH_FAILURE',
        timestamp: Date.now(),
        details: { error: action.error }
      }]
    }))

    // Handle logout
    .addCase(AuthActionTypes.LOGOUT, (state) => ({
      ...initialState,
      auditLog: [...state.auditLog, {
        event: 'LOGOUT',
        timestamp: Date.now(),
        details: { userId: state.user?.id }
      }]
    }));
});

export default authReducer;