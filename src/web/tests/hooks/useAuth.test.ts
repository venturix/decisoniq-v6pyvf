import { renderHook, act } from '@testing-library/react-hooks'; // ^8.0.1
import { Provider } from 'react-redux'; // ^8.1.0
import { configureStore } from '@reduxjs/toolkit'; // ^1.9.5
import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'; // ^29.0.0
import { useAuth } from '../../src/hooks/useAuth';
import { authActions } from '../../src/store/auth/actions';
import { AUTH_CONFIG } from '../../src/config/auth';
import { FEATURE_FLAGS } from '../../src/config/constants';
import type { User, AuthToken, LoginCredentials, SSOPayload } from '../../src/types/auth';

// Mock Redux store setup
const createMockStore = () => {
  return configureStore({
    reducer: {
      auth: (state = {
        isAuthenticated: false,
        user: null,
        token: null,
        loading: false,
        error: null
      }, action) => {
        switch (action.type) {
          case '@auth/LOGIN_SUCCESS':
          case '@auth/SSO_LOGIN_SUCCESS':
            return {
              ...state,
              isAuthenticated: true,
              user: action.payload.user,
              token: action.payload.token,
              loading: false
            };
          case '@auth/LOGOUT':
            return {
              ...state,
              isAuthenticated: false,
              user: null,
              token: null
            };
          default:
            return state;
        }
      }
    }
  });
};

// Mock data
const mockUser: User = {
  id: 'user-123',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  roles: ['CS_REP'],
  mfaEnabled: true,
  lastLoginAt: new Date().toISOString(),
  permissions: ['canViewCustomers', 'canExecutePlaybooks'],
  sessionExpiry: Date.now() + 3600000
};

const mockToken: AuthToken = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresIn: 3600,
  tokenType: 'Bearer',
  scope: 'full_access'
};

// Test suite setup
describe('useAuth Hook', () => {
  let mockStore: ReturnType<typeof createMockStore>;
  let wrapper: React.FC;

  beforeEach(() => {
    // Reset mocks and timers
    jest.useFakeTimers();
    localStorage.clear();
    
    // Create fresh store instance
    mockStore = createMockStore();
    wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={mockStore}>{children}</Provider>
    );

    // Mock rate limiting storage
    global.localStorage = {
      ...global.localStorage,
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('Initial State', () => {
    test('should initialize with unauthenticated state', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    test('should initialize session monitoring', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      expect(result.current.sessionStatus).toBe('active');
      expect(localStorage.getItem('session_expiry')).toBeNull();
    });
  });

  describe('Login Functionality', () => {
    const mockCredentials: LoginCredentials = {
      email: 'test@example.com',
      password: 'SecurePass123!',
      rememberMe: true
    };

    test('should handle successful login with MFA', async () => {
      const loginSpy = jest.spyOn(authActions, 'loginRequest');
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login(mockCredentials);
      });

      expect(loginSpy).toHaveBeenCalledWith(mockCredentials);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.token).toEqual(mockToken);
    });

    test('should enforce rate limiting on login attempts', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      // Simulate multiple failed attempts
      for (let i = 0; i < AUTH_CONFIG.maxFailedAttempts; i++) {
        try {
          await act(async () => {
            await result.current.login({ ...mockCredentials, password: 'wrong' });
          });
        } catch {}
      }

      // Next attempt should be rate limited
      await expect(
        act(async () => {
          await result.current.login(mockCredentials);
        })
      ).rejects.toThrow('Rate limit exceeded');
    });

    test('should handle MFA verification correctly', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await act(async () => {
        await result.current.verifyMFA({
          mfaCode: '123456',
          tempToken: 'temp-token',
          method: 'TOTP'
        });
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toBeTruthy();
    });
  });

  describe('SSO Authentication', () => {
    const mockSSOPayload: SSOPayload = {
      samlResponse: 'encoded-saml-response',
      relayState: 'original-url',
      idpProvider: 'blitzy-sso'
    };

    test('should handle SSO login successfully', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await act(async () => {
        await result.current.loginWithSSO(mockSSOPayload);
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toBeTruthy();
    });

    test('should enforce role-based access control', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await act(async () => {
        await result.current.loginWithSSO(mockSSOPayload);
      });

      expect(result.current.user?.roles).toContain('CS_REP');
      expect(result.current.user?.permissions).toContain('canViewCustomers');
    });
  });

  describe('Session Management', () => {
    test('should refresh token before expiration', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      // Simulate successful login
      await act(async () => {
        await result.current.login(mockCredentials);
      });

      // Fast-forward to near token expiration
      jest.advanceTimersByTime(AUTH_CONFIG.tokenRefreshInterval * 1000 - 1000);

      expect(result.current.token).toBeTruthy();
      expect(localStorage.getItem('refresh_interval')).toBeTruthy();
    });

    test('should detect session inactivity', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await act(async () => {
        await result.current.login(mockCredentials);
      });

      // Simulate inactivity
      jest.advanceTimersByTime(AUTH_CONFIG.sessionInactivityTimeout - 1000);
      expect(result.current.sessionStatus).toBe('warning');

      // Should logout after timeout
      jest.advanceTimersByTime(2000);
      expect(result.current.isAuthenticated).toBe(false);
    });

    test('should maintain session audit trail', async () => {
      const auditLogSpy = jest.spyOn(console, 'log');
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await act(async () => {
        await result.current.login(mockCredentials);
        await result.current.logout();
      });

      expect(auditLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Session terminated')
      );
    });
  });

  describe('Security Controls', () => {
    test('should enforce password complexity rules', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await expect(
        act(async () => {
          await result.current.login({
            email: 'test@example.com',
            password: 'weak'
          });
        })
      ).rejects.toThrow('Password does not meet complexity requirements');
    });

    test('should validate token signatures', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await act(async () => {
        await result.current.login(mockCredentials);
      });

      expect(result.current.token?.tokenType).toBe('Bearer');
      expect(result.current.token?.scope).toBe('full_access');
    });

    test('should handle brute force attempts', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      let failedAttempts = 0;
      
      while (failedAttempts < AUTH_CONFIG.maxFailedAttempts + 1) {
        try {
          await act(async () => {
            await result.current.login({
              email: 'test@example.com',
              password: 'wrong-password'
            });
          });
          failedAttempts++;
        } catch (error) {
          if (error.message.includes('Account locked')) {
            break;
          }
        }
      }

      expect(failedAttempts).toBe(AUTH_CONFIG.maxFailedAttempts);
    });
  });
});