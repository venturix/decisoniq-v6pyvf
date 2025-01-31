/**
 * Enterprise-grade SSO authentication page component for Customer Success AI Platform
 * Implements secure SAML 2.0 authentication with Blitzy Enterprise SSO
 * @version 1.0.0
 * @blitzy/auth ^2.0.0
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useErrorBoundary } from 'react-error-boundary';
import { useAuth } from '../../hooks/useAuth';
import { SSOCallback } from '../../components/auth/SSOCallback';
import { AUTH_CONFIG } from '../../config/auth';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import Card from '../../components/common/Card';
import { audit } from '@blitzy/audit-logging'; // ^2.0.0

// Rate limiting constants
const AUTH_RATE_LIMIT = 10; // Max attempts per minute
const AUTH_TIMEOUT_MS = 3000; // 3 second timeout per spec

/**
 * Props interface for SSO page component
 */
interface SSOProps {
  returnUrl?: string;
  onError?: (error: Error) => void;
}

/**
 * Enhanced SSO page component with comprehensive security controls
 * Implements enterprise authentication requirements with performance optimization
 */
const SSO: React.FC<SSOProps> = ({ returnUrl, onError }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showBoundary } = useErrorBoundary();
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<Error | null>(null);

  // Track authentication attempts for rate limiting
  const [authAttempts, setAuthAttempts] = useState(0);
  const [lastAttemptTime, setLastAttemptTime] = useState(Date.now());

  /**
   * Initializes SSO authentication flow with security validations
   */
  const initializeSSO = async () => {
    try {
      // Validate SSO configuration
      if (!AUTH_CONFIG.ssoEnabled || !AUTH_CONFIG.samlEndpoint) {
        throw new Error('SSO authentication is not configured');
      }

      // Implement rate limiting
      const currentTime = Date.now();
      if (
        authAttempts >= AUTH_RATE_LIMIT &&
        currentTime - lastAttemptTime < 60000
      ) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }

      // Update rate limiting counters
      setAuthAttempts(prev => prev + 1);
      setLastAttemptTime(currentTime);

      // Extract and validate return URL
      const targetUrl = returnUrl || searchParams.get('returnUrl') || '/dashboard';
      if (!targetUrl.startsWith('/')) {
        throw new Error('Invalid return URL');
      }

      // Log SSO initialization attempt
      await audit.log({
        event: 'SSO_INIT',
        target: 'SSO_PAGE',
        context: {
          returnUrl: targetUrl,
          timestamp: new Date().toISOString()
        }
      });

      // Construct SSO request URL with CSRF token
      const csrfToken = crypto.randomUUID();
      sessionStorage.setItem('sso_csrf_token', csrfToken);

      const ssoUrl = new URL(AUTH_CONFIG.samlEndpoint);
      ssoUrl.searchParams.append('client_id', process.env.VITE_BLITZY_CLIENT_ID!);
      ssoUrl.searchParams.append('redirect_uri', window.location.origin + '/auth/callback');
      ssoUrl.searchParams.append('response_type', 'code');
      ssoUrl.searchParams.append('state', csrfToken);
      ssoUrl.searchParams.append('return_url', targetUrl);

      // Redirect to Blitzy SSO endpoint
      window.location.href = ssoUrl.toString();

    } catch (error) {
      // Log initialization failure
      await audit.log({
        event: 'SSO_INIT_FAILURE',
        target: 'SSO_PAGE',
        context: {
          error: error.message,
          timestamp: new Date().toISOString()
        },
        level: 'ERROR'
      });

      setInitError(error as Error);
      if (onError) {
        onError(error as Error);
      } else {
        showBoundary(error);
      }
    } finally {
      setIsInitializing(false);
    }
  };

  // Initialize SSO flow on component mount
  useEffect(() => {
    const initTimeout = setTimeout(initializeSSO, 100);

    return () => {
      clearTimeout(initTimeout);
    };
  }, []);

  // Handle SSO callback if present
  const isCallback = window.location.pathname.endsWith('/callback');
  if (isCallback) {
    return (
      <ErrorBoundary
        fallback={<div>Authentication failed. Please try again.</div>}
        onError={onError}
      >
        <SSOCallback
          onError={onError}
          onSuccess={() => navigate(returnUrl || '/dashboard')}
        />
      </ErrorBoundary>
    );
  }

  // Render loading state during initialization
  if (isInitializing) {
    return (
      <Card
        variant="elevated"
        className="max-w-md mx-auto mt-20 p-8"
        highContrast={true}
      >
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <h2 className="text-xl font-semibold text-center">
            Initializing Secure Authentication
          </h2>
          <p className="text-sm text-center text-gray-600">
            Please wait while we establish a secure connection...
          </p>
        </div>
      </Card>
    );
  }

  // Render error state if initialization failed
  if (initError) {
    return (
      <Card
        variant="elevated"
        className="max-w-md mx-auto mt-20 p-8 border-error"
        highContrast={true}
      >
        <div className="flex flex-col items-center space-y-4">
          <div className="text-error text-4xl">⚠️</div>
          <h2 className="text-xl font-semibold text-center text-error">
            Authentication Error
          </h2>
          <p className="text-sm text-center text-gray-600">
            {initError.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-secondary transition-colors"
          >
            Try Again
          </button>
        </div>
      </Card>
    );
  }

  return null;
};

export default SSO;