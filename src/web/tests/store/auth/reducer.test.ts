// @jest/globals v29.0.0
import { describe, it, expect } from '@jest/globals';
import authReducer from '../../../src/store/auth/reducer';
import { AuthActionTypes } from '../../../src/store/auth/types';
import type { User } from '../../../src/types/auth';

describe('authReducer', () => {
  // Mock test data
  const mockUser: User = {
    id: 'test-user-id',
    email: 'test@example.com',
    roles: ['CS_MANAGER']
  } as User;

  const mockError = 'Authentication failed';
  const mockTempToken = 'temp-token-123';
  const mockRefreshToken = 'refresh-token-456';
  const mockAccessToken = 'access-token-789';

  // Initial state tests
  it('should return initial state', () => {
    const initialState = authReducer(undefined, { type: '@@INIT' });
    expect(initialState).toEqual({
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
    });
  });

  // Standard login flow tests
  describe('login flow', () => {
    it('should handle LOGIN_REQUEST', () => {
      const state = authReducer(undefined, {
        type: AuthActionTypes.LOGIN_REQUEST
      });
      expect(state.isLoading).toBe(true);
      expect(state.error).toBeNull();
      expect(state.auditLog[0].event).toBe('LOGIN_ATTEMPT');
    });

    it('should handle LOGIN_SUCCESS', () => {
      const state = authReducer(
        { ...authReducer(undefined, { type: '@@INIT' }), isLoading: true },
        {
          type: AuthActionTypes.LOGIN_SUCCESS,
          payload: {
            user: mockUser,
            token: { refreshToken: mockRefreshToken }
          }
        }
      );
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.user).toEqual(mockUser);
      expect(state.refreshToken).toBe(mockRefreshToken);
      expect(state.sessionExpiry).toBeDefined();
      expect(state.lastActivity).toBeDefined();
      expect(state.auditLog[0].event).toBe('LOGIN_SUCCESS');
    });

    it('should handle LOGIN_FAILURE', () => {
      const state = authReducer(
        { ...authReducer(undefined, { type: '@@INIT' }), isLoading: true },
        {
          type: AuthActionTypes.LOGIN_FAILURE,
          error: mockError
        }
      );
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe(mockError);
      expect(state.auditLog[0].event).toBe('LOGIN_FAILURE');
    });
  });

  // SSO authentication tests
  describe('SSO authentication', () => {
    it('should handle SSO_LOGIN_REQUEST', () => {
      const state = authReducer(undefined, {
        type: AuthActionTypes.SSO_LOGIN_REQUEST
      });
      expect(state.isLoading).toBe(true);
      expect(state.error).toBeNull();
      expect(state.auditLog[0].event).toBe('SSO_LOGIN_ATTEMPT');
    });

    it('should handle SSO_LOGIN_SUCCESS', () => {
      const state = authReducer(
        { ...authReducer(undefined, { type: '@@INIT' }), isLoading: true },
        {
          type: AuthActionTypes.SSO_LOGIN_SUCCESS,
          payload: {
            user: { ...mockUser, ssoProvider: 'OKTA' },
            token: { refreshToken: mockRefreshToken }
          }
        }
      );
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.user).toBeDefined();
      expect(state.refreshToken).toBe(mockRefreshToken);
      expect(state.sessionExpiry).toBeDefined();
      expect(state.auditLog[0].event).toBe('SSO_LOGIN_SUCCESS');
    });

    it('should handle SSO_LOGIN_FAILURE', () => {
      const state = authReducer(
        { ...authReducer(undefined, { type: '@@INIT' }), isLoading: true },
        {
          type: AuthActionTypes.SSO_LOGIN_FAILURE,
          error: mockError
        }
      );
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe(mockError);
      expect(state.auditLog[0].event).toBe('SSO_LOGIN_FAILURE');
    });
  });

  // MFA flow tests
  describe('MFA flow', () => {
    it('should handle MFA_REQUIRED', () => {
      const state = authReducer(undefined, {
        type: AuthActionTypes.MFA_REQUIRED,
        payload: { tempToken: mockTempToken }
      });
      expect(state.mfaRequired).toBe(true);
      expect(state.tempToken).toBe(mockTempToken);
      expect(state.auditLog[0].event).toBe('MFA_REQUIRED');
    });

    it('should handle MFA_SUCCESS', () => {
      const state = authReducer(
        {
          ...authReducer(undefined, { type: '@@INIT' }),
          mfaRequired: true,
          tempToken: mockTempToken
        },
        {
          type: AuthActionTypes.MFA_SUCCESS,
          payload: {
            user: mockUser,
            token: { refreshToken: mockRefreshToken }
          }
        }
      );
      expect(state.isAuthenticated).toBe(true);
      expect(state.mfaRequired).toBe(false);
      expect(state.tempToken).toBeNull();
      expect(state.user).toEqual(mockUser);
      expect(state.refreshToken).toBe(mockRefreshToken);
      expect(state.auditLog[0].event).toBe('MFA_SUCCESS');
    });

    it('should handle MFA_FAILURE', () => {
      const state = authReducer(
        {
          ...authReducer(undefined, { type: '@@INIT' }),
          mfaRequired: true,
          tempToken: mockTempToken
        },
        {
          type: AuthActionTypes.MFA_FAILURE,
          error: mockError
        }
      );
      expect(state.error).toBe(mockError);
      expect(state.auditLog[0].event).toBe('MFA_FAILURE');
    });
  });

  // Session management tests
  describe('session management', () => {
    it('should handle TOKEN_REFRESH_REQUEST', () => {
      const state = authReducer(
        {
          ...authReducer(undefined, { type: '@@INIT' }),
          isAuthenticated: true,
          user: mockUser,
          refreshToken: mockRefreshToken
        },
        {
          type: AuthActionTypes.TOKEN_REFRESH_REQUEST
        }
      );
      expect(state.isLoading).toBe(true);
      expect(state.auditLog[0].event).toBe('TOKEN_REFRESH_ATTEMPT');
    });

    it('should handle TOKEN_REFRESH_SUCCESS', () => {
      const state = authReducer(
        {
          ...authReducer(undefined, { type: '@@INIT' }),
          isAuthenticated: true,
          user: mockUser,
          isLoading: true
        },
        {
          type: AuthActionTypes.TOKEN_REFRESH_SUCCESS,
          payload: {
            refreshToken: mockRefreshToken
          }
        }
      );
      expect(state.isLoading).toBe(false);
      expect(state.refreshToken).toBe(mockRefreshToken);
      expect(state.sessionExpiry).toBeDefined();
      expect(state.lastActivity).toBeDefined();
      expect(state.auditLog[0].event).toBe('TOKEN_REFRESH_SUCCESS');
    });

    it('should handle TOKEN_REFRESH_FAILURE', () => {
      const state = authReducer(
        {
          ...authReducer(undefined, { type: '@@INIT' }),
          isAuthenticated: true,
          user: mockUser,
          refreshToken: mockRefreshToken,
          isLoading: true
        },
        {
          type: AuthActionTypes.TOKEN_REFRESH_FAILURE,
          error: mockError
        }
      );
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.user).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.error).toBe(mockError);
      expect(state.auditLog[0].event).toBe('TOKEN_REFRESH_FAILURE');
    });

    it('should handle SESSION_EXPIRED', () => {
      const state = authReducer(
        {
          ...authReducer(undefined, { type: '@@INIT' }),
          isAuthenticated: true,
          user: mockUser,
          refreshToken: mockRefreshToken
        },
        {
          type: AuthActionTypes.SESSION_EXPIRED
        }
      );
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.sessionExpiry).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.auditLog[0].event).toBe('SESSION_EXPIRED');
    });
  });

  // Logout test
  it('should handle LOGOUT', () => {
    const state = authReducer(
      {
        ...authReducer(undefined, { type: '@@INIT' }),
        isAuthenticated: true,
        user: mockUser,
        refreshToken: mockRefreshToken
      },
      {
        type: AuthActionTypes.LOGOUT
      }
    );
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.auditLog[0].event).toBe('LOGOUT');
  });

  // Security validation tests
  describe('security validations', () => {
    it('should maintain audit log immutability', () => {
      const initialState = authReducer(undefined, { type: '@@INIT' });
      const state = authReducer(initialState, {
        type: AuthActionTypes.LOGIN_REQUEST
      });
      expect(() => {
        state.auditLog.push({ event: 'HACK', timestamp: Date.now() });
      }).toThrow();
    });

    it('should prevent direct state mutations', () => {
      const state = authReducer(undefined, { type: '@@INIT' });
      expect(() => {
        (state.user as any) = mockUser;
      }).toThrow();
    });

    it('should clear sensitive data on session expiry', () => {
      const state = authReducer(
        {
          ...authReducer(undefined, { type: '@@INIT' }),
          isAuthenticated: true,
          user: mockUser,
          refreshToken: mockRefreshToken,
          tempToken: mockTempToken
        },
        {
          type: AuthActionTypes.SESSION_EXPIRED
        }
      );
      expect(state.user).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.tempToken).toBeNull();
      expect(state.sessionExpiry).toBeNull();
    });
  });
});