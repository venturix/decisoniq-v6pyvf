import React, { memo, useEffect } from 'react';
import classNames from 'classnames'; // ^2.3.0
import { BlitzyUI } from '@blitzy/premium-ui'; // ^2.0.0
import Layout from '../components/common/Layout';
import LoginForm from '../components/auth/LoginForm';
import { useTheme } from '../hooks/useTheme';

// Security level configuration for authentication pages
export enum AuthSecurityLevel {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

// Props interface with strict typing
interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  securityLevel?: AuthSecurityLevel;
  onSecurityError?: (error: Error) => void;
}

// CSS classes for auth layout styling
const AUTH_LAYOUT_CLASSES = {
  container: 'min-h-screen flex items-center justify-center bg-surface py-12 px-4 sm:px-6 lg:px-8',
  content: 'max-w-md w-full space-y-8 secure-context',
  branding: 'mx-auto h-12 w-auto enterprise-brand',
  title: 'mt-6 text-center text-3xl font-extrabold text-text dark:text-white high-contrast:text-black fluid-type',
  subtitle: 'mt-2 text-center text-sm text-textSecondary dark:text-gray-400 high-contrast:text-gray-900 fluid-type',
  securityBadge: 'absolute top-4 right-4 security-indicator',
  errorBoundary: 'auth-error-container'
} as const;

// Security configuration for auth pages
const AUTH_SECURITY_CONFIG = {
  cspDirectives: {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'wasm-unsafe-eval'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'https:'],
    'connect-src': ["'self'", process.env.VITE_API_BASE_URL],
    'frame-ancestors': ["'none'"],
    'form-action': ["'self'"]
  },
  securityHeaders: {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  }
} as const;

/**
 * Enhanced authentication layout component with enterprise security features
 * Implements WCAG 2.1 Level AA compliance and Blitzy Enterprise Design System
 */
const AuthLayout = memo<AuthLayoutProps>(({
  children,
  title,
  subtitle,
  securityLevel = AuthSecurityLevel.HIGH,
  onSecurityError
}) => {
  const { theme } = useTheme();

  // Apply security headers and CSP
  useEffect(() => {
    try {
      // Set Content Security Policy
      const cspString = Object.entries(AUTH_SECURITY_CONFIG.cspDirectives)
        .map(([key, values]) => `${key} ${values.join(' ')}`)
        .join('; ');
      
      document.querySelector('meta[http-equiv="Content-Security-Policy"]')
        ?.setAttribute('content', cspString);

      // Set security headers
      Object.entries(AUTH_SECURITY_CONFIG.securityHeaders).forEach(([key, value]) => {
        document.querySelector(`meta[http-equiv="${key}"]`)
          ?.setAttribute('content', value);
      });
    } catch (error) {
      onSecurityError?.(error as Error);
    }
  }, [onSecurityError]);

  // Monitor for security violations
  useEffect(() => {
    const handleSecurityViolation = (event: SecurityPolicyViolationEvent) => {
      onSecurityError?.(new Error(`Security violation: ${event.violatedDirective}`));
    };

    document.addEventListener('securitypolicyviolation', handleSecurityViolation);
    return () => {
      document.removeEventListener('securitypolicyviolation', handleSecurityViolation);
    };
  }, [onSecurityError]);

  return (
    <Layout
      title={title}
      role="main"
      ariaLabel="Authentication page"
      showSidebar={false}
    >
      <BlitzyUI.ErrorBoundary
        FallbackComponent={BlitzyUI.ErrorFallback}
        onError={onSecurityError}
      >
        <div 
          className={classNames(
            AUTH_LAYOUT_CLASSES.container,
            `security-level-${securityLevel}`,
            {
              'high-contrast': theme.mode === 'high-contrast'
            }
          )}
          data-testid="auth-layout"
        >
          <div className={AUTH_LAYOUT_CLASSES.content}>
            {/* Enterprise branding */}
            <div className={AUTH_LAYOUT_CLASSES.branding}>
              <img
                src="/logo.svg"
                alt="Customer Success AI Platform"
                className="h-full w-auto"
              />
            </div>

            {/* Accessible headings */}
            <h1 
              className={AUTH_LAYOUT_CLASSES.title}
              tabIndex={-1}
            >
              {title}
            </h1>
            
            {subtitle && (
              <p 
                className={AUTH_LAYOUT_CLASSES.subtitle}
                role="doc-subtitle"
              >
                {subtitle}
              </p>
            )}

            {/* Security badge for high-security pages */}
            {securityLevel === AuthSecurityLevel.HIGH && (
              <BlitzyUI.SecurityBadge
                className={AUTH_LAYOUT_CLASSES.securityBadge}
                level={securityLevel}
              />
            )}

            {/* Main content area with security context */}
            <main
              role="main"
              aria-labelledby="auth-title"
              className="auth-content-area"
            >
              {children}
            </main>
          </div>
        </div>
      </BlitzyUI.ErrorBoundary>
    </Layout>
  );
});

AuthLayout.displayName = 'AuthLayout';

export default AuthLayout;