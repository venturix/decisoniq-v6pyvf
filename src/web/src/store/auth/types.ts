// @blitzy/auth v2.0.0 - Redux action types for enterprise authentication
import { Action } from 'redux'; // v4.2.0
import {
  User,
  AuthToken,
  LoginCredentials,
  SSOPayload,
  MFAVerification
} from '../../types/auth';

/**
 * Enumeration of all possible authentication action types
 * Provides type-safe constants for Redux actions
 */
export enum AuthActionTypes {
  // Login flow
  LOGIN_REQUEST = '@auth/LOGIN_REQUEST',
  LOGIN_SUCCESS = '@auth/LOGIN_SUCCESS',
  LOGIN_FAILURE = '@auth/LOGIN_FAILURE',

  // SSO authentication
  SSO_LOGIN_REQUEST = '@auth/SSO_LOGIN_REQUEST',
  SSO_LOGIN_SUCCESS = '@auth/SSO_LOGIN_SUCCESS', 
  SSO_LOGIN_FAILURE = '@auth/SSO_LOGIN_FAILURE',

  // Multi-factor authentication
  MFA_REQUIRED = '@auth/MFA_REQUIRED',
  MFA_VERIFY = '@auth/MFA_VERIFY',
  MFA_SUCCESS = '@auth/MFA_SUCCESS',
  MFA_FAILURE = '@auth/MFA_FAILURE',

  // Session management
  SESSION_EXPIRED = '@auth/SESSION_EXPIRED',
  REFRESH_TOKEN = '@auth/REFRESH_TOKEN',
  REFRESH_TOKEN_SUCCESS = '@auth/REFRESH_TOKEN_SUCCESS',
  REFRESH_TOKEN_FAILURE = '@auth/REFRESH_TOKEN_FAILURE',
  LOGOUT = '@auth/LOGOUT'
}

/**
 * Login action interfaces
 */
export interface LoginRequestAction extends Action<AuthActionTypes.LOGIN_REQUEST> {
  payload: LoginCredentials;
}

export interface LoginSuccessAction extends Action<AuthActionTypes.LOGIN_SUCCESS> {
  payload: {
    user: User;
    token: AuthToken;
  };
}

export interface LoginFailureAction extends Action<AuthActionTypes.LOGIN_FAILURE> {
  error: string;
}

/**
 * SSO authentication action interfaces
 */
export interface SSOLoginRequestAction extends Action<AuthActionTypes.SSO_LOGIN_REQUEST> {
  payload: SSOPayload;
}

export interface SSOLoginSuccessAction extends Action<AuthActionTypes.SSO_LOGIN_SUCCESS> {
  payload: {
    user: User;
    token: AuthToken;
  };
}

export interface SSOLoginFailureAction extends Action<AuthActionTypes.SSO_LOGIN_FAILURE> {
  error: string;
}

/**
 * MFA action interfaces
 */
export interface MFARequiredAction extends Action<AuthActionTypes.MFA_REQUIRED> {
  payload: {
    tempToken: string;
    method: 'TOTP' | 'SMS';
  };
}

export interface MFAVerifyAction extends Action<AuthActionTypes.MFA_VERIFY> {
  payload: MFAVerification;
}

export interface MFASuccessAction extends Action<AuthActionTypes.MFA_SUCCESS> {
  payload: {
    user: User;
    token: AuthToken;
  };
}

export interface MFAFailureAction extends Action<AuthActionTypes.MFA_FAILURE> {
  error: string;
}

/**
 * Session management action interfaces
 */
export interface SessionExpiredAction extends Action<AuthActionTypes.SESSION_EXPIRED> {}

export interface RefreshTokenAction extends Action<AuthActionTypes.REFRESH_TOKEN> {
  payload: {
    refreshToken: string;
  };
}

export interface RefreshTokenSuccessAction extends Action<AuthActionTypes.REFRESH_TOKEN_SUCCESS> {
  payload: AuthToken;
}

export interface RefreshTokenFailureAction extends Action<AuthActionTypes.REFRESH_TOKEN_FAILURE> {
  error: string;
}

export interface LogoutAction extends Action<AuthActionTypes.LOGOUT> {}

/**
 * Union type of all possible authentication actions
 * Provides type safety for action handlers
 */
export type AuthAction =
  | LoginRequestAction
  | LoginSuccessAction
  | LoginFailureAction
  | SSOLoginRequestAction
  | SSOLoginSuccessAction
  | SSOLoginFailureAction
  | MFARequiredAction
  | MFAVerifyAction
  | MFASuccessAction
  | MFAFailureAction
  | SessionExpiredAction
  | RefreshTokenAction
  | RefreshTokenSuccessAction
  | RefreshTokenFailureAction
  | LogoutAction;