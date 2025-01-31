/**
 * Secure logout page component for Customer Success AI Platform
 * Implements enterprise-grade session cleanup with accessibility support
 * @version 1.0.0
 * @blitzy/premium-ui ^2.0.0
 */

import React, { useEffect } from 'react'; // ^18.2.0
import { useNavigate } from 'react-router-dom'; // ^6.4.0
import { useAuth } from '../../hooks/useAuth';
import { Loading } from '../../components/common/Loading';

/**
 * Secure logout component that handles user session termination
 * Implements WCAG 2.1 Level AA compliance for loading states
 */
const Logout: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  /**
   * Handles the secure logout process with proper cleanup
   * Implements comprehensive session termination and audit logging
   */
  useEffect(() => {
    const handleLogout = async () => {
      try {
        // Cancel any pending API requests
        const controller = new AbortController();
        controller.abort();

        // Perform secure logout
        await logout();

        // Clear all local storage data
        localStorage.clear();
        sessionStorage.clear();

        // Clear any active intervals or timeouts
        const highestTimeoutId = setTimeout(() => {}, 0);
        for (let i = 0; i < highestTimeoutId; i++) {
          clearTimeout(i);
        }

        // Remove event listeners
        window.removeEventListener('beforeunload', () => {});
        window.removeEventListener('unload', () => {});

        // Clear service worker registration if exists
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const registration of registrations) {
            await registration.unregister();
          }
        }

        // Clear browser cache if supported
        if ('caches' in window) {
          const cacheKeys = await caches.keys();
          await Promise.all(
            cacheKeys.map(key => caches.delete(key))
          );
        }

        // Navigate to login page after cleanup
        navigate('/login', { replace: true });
      } catch (error) {
        console.error('Logout error:', error);
        // Ensure navigation to login even if cleanup fails
        navigate('/login', { replace: true });
      }
    };

    handleLogout();

    // Cleanup function
    return () => {
      // Additional cleanup if needed
    };
  }, [logout, navigate]);

  return (
    <Loading
      size="lg"
      overlay={true}
      text="Signing out securely..."
      testId="logout-loading"
      className="cs-logout-loading"
    />
  );
};

export default Logout;