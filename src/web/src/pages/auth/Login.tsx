import React, { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from '../../layouts/AuthLayout';
import LoginForm from '../../components/auth/LoginForm';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import type { User } from '../../types/auth';

// Constants for login page configuration
const LOGIN_CONFIG = {
  TITLE: 'Sign in to your account',
  SUBTITLE: 'Access your Customer Success AI Platform',
  DASHBOARD_ROUTE: '/dashboard',
  ERROR_MESSAGES: {
    RATE_LIMIT: 'Too many attempts. Please try again later.',
    INVALID_CREDENTIALS: 'Invalid email or password',
    MFA_REQUIRED: 'Please enter your verification code',
    SSO_ERROR: 'SSO authentication failed',
    NETWORK_ERROR: 'Connection error. Please try again'
  }
} as const;

/**
 * Enhanced login page component with enterprise security features
 * Implements Blitzy Enterprise SSO and MFA authentication
 * @version 1.0.0
 */
const LoginPage = React.memo(() => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { theme } = useTheme();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(LOGIN_CONFIG.DASHBOARD_ROUTE, { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  // Handle successful login with security logging
  const handleLoginSuccess = useCallback((authenticatedUser: User) => {
    // Log successful authentication event
    console.info('Authentication successful', {
      userId: authenticatedUser.id,
      timestamp: new Date().toISOString(),
      method: 'credentials'
    });

    // Navigate to dashboard
    navigate(LOGIN_CONFIG.DASHBOARD_ROUTE, { replace: true });
  }, [navigate]);

  // Handle login errors with comprehensive error tracking
  const handleLoginError = useCallback((error: Error) => {
    // Log authentication failure with security context
    console.error('Authentication failed', {
      error: error.message,
      timestamp: new Date().toISOString(),
      errorCode: error.name
    });

    // Update error metrics
    if (error.name === 'RATE_LIMIT_ERROR') {
      // Track rate limit violations
      console.warn('Rate limit exceeded', {
        timestamp: new Date().toISOString()
      });
    }
  }, []);

  return (
    <AuthLayout
      title={LOGIN_CONFIG.TITLE}
      subtitle={LOGIN_CONFIG.SUBTITLE}
      securityLevel="high"
      onSecurityError={handleLoginError}
    >
      <div
        className="login-container"
        role="main"
        aria-labelledby="login-title"
      >
        <LoginForm
          onSuccess={handleLoginSuccess}
          onError={handleLoginError}
          redirectUrl={LOGIN_CONFIG.DASHBOARD_ROUTE}
          maxAttempts={5}
          requireMFA={true}
          theme={theme}
        />

        {/* Accessibility skip link */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:p-2"
        >
          Skip to main content
        </a>

        {/* Security information for screen readers */}
        <div className="sr-only" role="status" aria-live="polite">
          This is a secure login page with enterprise-grade authentication
        </div>
      </div>
    </AuthLayout>
  );
});

LoginPage.displayName = 'LoginPage';

export default LoginPage;