/**
 * Enterprise-grade SSO callback handler component for Customer Success AI Platform
 * Implements secure SAML authentication with Blitzy Enterprise SSO
 * @version 1.0.0
 * @blitzy/auth ^2.0.0
 */

import { useEffect } from 'react'; // ^18.2.0
import { useNavigate, useSearchParams } from 'react-router-dom'; // ^6.4.0
import { useErrorBoundary } from 'react-error-boundary'; // ^4.0.0
import { useAuth } from '../../hooks/useAuth';
import type { SSOPayload } from '../../types/auth';
import { audit } from '@blitzy/audit-logging'; // ^2.0.0
import { useSecureSession } from '@blitzy/secure-session'; // ^1.0.0

/**
 * Props interface for SSOCallback component with strict typing
 */
interface SSOCallbackProps {
  onError?: (error: Error) => void;
  onSuccess?: () => void;
}

/**
 * Enterprise SSO callback component that securely handles SAML authentication
 * Implements comprehensive security controls and audit logging
 */
const SSOCallback: React.FC<SSOCallbackProps> = ({ onError, onSuccess }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginWithSSO } = useAuth();
  const { showBoundary } = useErrorBoundary();
  const { initializeSession } = useSecureSession();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Extract and validate SAML response parameters
        const samlResponse = searchParams.get('SAMLResponse');
        const relayState = searchParams.get('RelayState');
        const idpProvider = searchParams.get('IdP');

        if (!samlResponse || !relayState || !idpProvider) {
          throw new Error('Invalid SSO callback parameters');
        }

        // Construct SSO payload with strict typing
        const ssoPayload: SSOPayload = {
          samlResponse,
          relayState,
          idpProvider
        };

        // Log SSO attempt for security audit
        await audit.log({
          event: 'SSO_AUTHENTICATION_ATTEMPT',
          actor: idpProvider,
          target: 'SSO_CALLBACK',
          context: {
            relayState,
            idpProvider
          }
        });

        // Process SSO authentication
        const authResult = await loginWithSSO(ssoPayload);

        // Initialize secure session
        await initializeSession({
          userId: authResult.user?.id,
          sessionId: crypto.randomUUID(),
          expiresAt: Date.now() + (authResult.expiresIn * 1000)
        });

        // Log successful authentication
        await audit.log({
          event: 'SSO_AUTHENTICATION_SUCCESS',
          actor: authResult.user?.id,
          target: 'SSO_CALLBACK',
          context: {
            idpProvider,
            roles: authResult.user?.roles
          }
        });

        // Handle successful authentication
        onSuccess?.();
        navigate('/dashboard', { replace: true });

      } catch (error) {
        // Log authentication failure
        await audit.log({
          event: 'SSO_AUTHENTICATION_FAILURE',
          actor: searchParams.get('IdP'),
          target: 'SSO_CALLBACK',
          context: {
            error: error.message
          },
          level: 'ERROR'
        });

        // Handle error with provided callback or error boundary
        if (onError) {
          onError(error as Error);
        } else {
          showBoundary(error);
        }

        // Redirect to login on failure
        navigate('/login', {
          replace: true,
          state: { error: 'SSO authentication failed' }
        });
      }
    };

    handleCallback();
  }, [searchParams, loginWithSSO, navigate, onError, onSuccess, showBoundary, initializeSession]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white rounded-lg shadow-md">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <h2 className="mt-4 text-lg font-semibold text-gray-700">
            Processing SSO Authentication...
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Please wait while we securely verify your identity
          </p>
        </div>
      </div>
    </div>
  );
};

export default SSOCallback;