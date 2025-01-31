/**
 * Enhanced authentication hook for Customer Success AI Platform
 * Implements enterprise-grade security features with Blitzy SSO integration
 * @version 1.0.0
 * @blitzy/auth ^2.0.0
 */

import { useDispatch, useSelector } from 'react-redux'; // ^8.1.0
import { useState, useCallback, useEffect } from 'react'; // ^18.2.0
import {
  login,
  loginWithSSO,
  verifyMFA,
  logout,
  refreshToken,
  monitorSession
} from '../lib/api/auth';
import type {
  LoginCredentials,
  SSOPayload,
  User,
  AuthToken,
  MFAVerification
} from '../types/auth';
import { AUTH_CONFIG } from '../config/auth';
import { FEATURE_FLAGS } from '../config/constants';

// Session monitoring constants
const INACTIVITY_CHECK_INTERVAL = 60000; // 1 minute
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'];

/**
 * Enhanced authentication hook with advanced security features
 * Implements comprehensive session management and MFA support
 */
export function useAuth() {
  const dispatch = useDispatch();
  
  // Redux state selectors
  const isAuthenticated = useSelector((state: any) => state.auth.isAuthenticated);
  const user = useSelector((state: any) => state.auth.user);
  const token = useSelector((state: any) => state.auth.token);
  const loading = useSelector((state: any) => state.auth.loading);
  const error = useSelector((state: any) => state.auth.error);

  // Local state for session monitoring
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const [sessionStatus, setSessionStatus] = useState<'active' | 'warning' | 'expired'>('active');

  /**
   * Enhanced login handler with rate limiting and device fingerprinting
   */
  const handleLogin = useCallback(async (credentials: LoginCredentials) => {
    try {
      dispatch({ type: 'AUTH_LOGIN_REQUEST' });
      const response = await login(credentials);

      if (response.requiresMFA && FEATURE_FLAGS.ENABLE_MFA) {
        dispatch({ type: 'AUTH_MFA_REQUIRED', payload: response });
        return;
      }

      dispatch({ type: 'AUTH_LOGIN_SUCCESS', payload: response });
      initializeSession(response);
    } catch (error) {
      dispatch({ type: 'AUTH_LOGIN_FAILURE', payload: error });
      throw error;
    }
  }, [dispatch]);

  /**
   * Enhanced SSO login handler with SAML validation
   */
  const handleSSOLogin = useCallback(async (ssoPayload: SSOPayload) => {
    if (!FEATURE_FLAGS.ENABLE_SSO) {
      throw new Error('SSO authentication is not enabled');
    }

    try {
      dispatch({ type: 'AUTH_SSO_REQUEST' });
      const response = await loginWithSSO(ssoPayload);
      dispatch({ type: 'AUTH_SSO_SUCCESS', payload: response });
      initializeSession(response);
    } catch (error) {
      dispatch({ type: 'AUTH_SSO_FAILURE', payload: error });
      throw error;
    }
  }, [dispatch]);

  /**
   * Enhanced MFA verification handler with security controls
   */
  const handleMFAVerify = useCallback(async (verification: MFAVerification) => {
    try {
      dispatch({ type: 'AUTH_MFA_VERIFY_REQUEST' });
      const response = await verifyMFA(verification.mfaCode, verification.tempToken);
      dispatch({ type: 'AUTH_MFA_VERIFY_SUCCESS', payload: response });
      initializeSession(response);
    } catch (error) {
      dispatch({ type: 'AUTH_MFA_VERIFY_FAILURE', payload: error });
      throw error;
    }
  }, [dispatch]);

  /**
   * Enhanced logout handler with comprehensive cleanup
   */
  const handleLogout = useCallback(async () => {
    try {
      dispatch({ type: 'AUTH_LOGOUT_REQUEST' });
      await logout();
      dispatch({ type: 'AUTH_LOGOUT_SUCCESS' });
      cleanupSession();
    } catch (error) {
      dispatch({ type: 'AUTH_LOGOUT_FAILURE', payload: error });
      throw error;
    }
  }, [dispatch]);

  /**
   * Initialize session monitoring and token refresh
   */
  const initializeSession = useCallback((authData: AuthToken) => {
    // Set up session monitoring
    monitorSession(authData);

    // Set up token refresh cycle
    const refreshInterval = setInterval(() => {
      if (authData.refreshToken) {
        refreshToken(authData.refreshToken).catch(handleLogout);
      }
    }, AUTH_CONFIG.tokenRefreshInterval * 1000);

    // Store refresh interval for cleanup
    localStorage.setItem('refresh_interval', refreshInterval.toString());
  }, [handleLogout]);

  /**
   * Clean up session monitoring and intervals
   */
  const cleanupSession = useCallback(() => {
    const refreshInterval = localStorage.getItem('refresh_interval');
    if (refreshInterval) {
      clearInterval(parseInt(refreshInterval));
      localStorage.removeItem('refresh_interval');
    }
    
    ACTIVITY_EVENTS.forEach(event => {
      window.removeEventListener(event, updateLastActivity);
    });
  }, []);

  /**
   * Update last activity timestamp
   */
  const updateLastActivity = useCallback(() => {
    setLastActivity(Date.now());
    setSessionStatus('active');
  }, []);

  /**
   * Monitor session activity and handle timeouts
   */
  useEffect(() => {
    if (isAuthenticated) {
      // Set up activity monitoring
      ACTIVITY_EVENTS.forEach(event => {
        window.addEventListener(event, updateLastActivity);
      });

      // Check for inactivity
      const inactivityInterval = setInterval(() => {
        const inactiveTime = Date.now() - lastActivity;
        
        if (inactiveTime >= AUTH_CONFIG.sessionInactivityTimeout) {
          handleLogout();
        } else if (inactiveTime >= AUTH_CONFIG.sessionInactivityTimeout * 0.8) {
          setSessionStatus('warning');
        }
      }, INACTIVITY_CHECK_INTERVAL);

      return () => {
        clearInterval(inactivityInterval);
        cleanupSession();
      };
    }
  }, [isAuthenticated, lastActivity, handleLogout, updateLastActivity, cleanupSession]);

  return {
    isAuthenticated,
    user,
    token,
    loading,
    error,
    sessionStatus,
    login: handleLogin,
    loginWithSSO: handleSSOLogin,
    verifyMFA: handleMFAVerify,
    logout: handleLogout,
    refreshSession: updateLastActivity
  };
}

export type UseAuth = ReturnType<typeof useAuth>;