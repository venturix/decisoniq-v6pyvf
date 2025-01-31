import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useWebSocket from '@websocket/core';
import CustomerDetails from '../../components/customers/CustomerDetails';
import RiskIndicators from '../../components/customers/RiskIndicators';
import InteractionHistory from '../../components/customers/InteractionHistory';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import { useTheme } from '../../hooks/useTheme';
import type { Customer } from '../../types/customer';
import type { RiskScore } from '../../types/risk';

interface CustomerProfileProps {
  customerId: string;
}

interface CustomerProfileState {
  isLoading: boolean;
  error: Error | null;
  lastUpdated: Date;
  optimisticUpdates: Map<string, any>;
}

/**
 * CustomerProfile component - Main customer profile view
 * Implements comprehensive customer overview with real-time updates
 * @version 1.0.0
 */
const CustomerProfile: React.FC<CustomerProfileProps> = ({ customerId }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const effectiveCustomerId = customerId || id;

  // Component state
  const [state, setState] = useState<CustomerProfileState>({
    isLoading: true,
    error: null,
    lastUpdated: new Date(),
    optimisticUpdates: new Map()
  });

  // WebSocket setup for real-time updates
  const { socket, connected } = useWebSocket({
    url: '/customer-events',
    options: {
      auth: { customerId: effectiveCustomerId },
      reconnectionAttempts: 3,
      reconnectionDelay: 1000
    }
  });

  /**
   * Handles incoming WebSocket messages for real-time updates
   */
  const handleWebSocketMessage = useCallback((message: any) => {
    try {
      const { type, data } = message;
      
      setState(prev => ({
        ...prev,
        optimisticUpdates: new Map(prev.optimisticUpdates).set(type, data),
        lastUpdated: new Date()
      }));
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  }, []);

  /**
   * Handles component errors with retry logic
   */
  const handleError = useCallback((error: Error) => {
    setState(prev => ({
      ...prev,
      error,
      isLoading: false
    }));
  }, []);

  // Setup WebSocket listeners
  useEffect(() => {
    if (connected && socket) {
      socket.on('customer-update', handleWebSocketMessage);
      socket.on('risk-update', handleWebSocketMessage);
      socket.on('interaction-update', handleWebSocketMessage);

      return () => {
        socket.off('customer-update', handleWebSocketMessage);
        socket.off('risk-update', handleWebSocketMessage);
        socket.off('interaction-update', handleWebSocketMessage);
      };
    }
  }, [connected, socket, handleWebSocketMessage]);

  return (
    <ErrorBoundary
      onError={handleError}
      enableRetry
      showToast
      errorTitle={t('customer.profile.error')}
    >
      <main
        className="customer-profile"
        role="main"
        aria-label={t('customer.profile.title')}
      >
        <div className="customer-profile__grid">
          {/* Customer Details Section */}
          <section
            className="customer-profile__details"
            aria-label={t('customer.profile.details')}
          >
            <CustomerDetails
              customerId={effectiveCustomerId}
              className="customer-profile__card"
              onError={handleError}
            />
          </section>

          {/* Risk Assessment Section */}
          <section
            className="customer-profile__risk"
            aria-label={t('customer.profile.risk')}
          >
            <RiskIndicators
              riskScore={state.optimisticUpdates.get('risk-update') as RiskScore}
              className="customer-profile__card"
              highContrast={theme.mode === 'high-contrast'}
            />
          </section>

          {/* Interaction History Section */}
          <section
            className="customer-profile__history"
            aria-label={t('customer.profile.history')}
          >
            <InteractionHistory
              customerId={effectiveCustomerId}
              className="customer-profile__card"
              pageSize={10}
            />
          </section>
        </div>

        {/* Last Updated Indicator */}
        <div
          className="customer-profile__status"
          role="status"
          aria-live="polite"
        >
          {t('customer.profile.lastUpdated', {
            time: state.lastUpdated.toLocaleTimeString()
          })}
        </div>
      </main>
    </ErrorBoundary>
  );
};

CustomerProfile.displayName = 'CustomerProfile';

export default CustomerProfile;