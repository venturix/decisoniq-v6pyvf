import React, { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query'; // ^4.0.0
import { BlitzyUI } from '@blitzy/premium-ui'; // ^2.0.0
import { useLogger } from '@blitzy/logging'; // ^1.0.0

import Layout from '../../components/common/Layout';
import Card from '../../components/common/Card';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import { useTheme } from '../../hooks/useTheme';

// Integration configuration interfaces
interface SecurityConfig {
  encryptionEnabled: boolean;
  certificateId?: string;
  apiKeyRotation: boolean;
  dataRetention: number;
}

interface HealthCheckConfig {
  enabled: boolean;
  interval: number;
  timeout: number;
  threshold: number;
}

interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

interface IntegrationConfig {
  id: string;
  type: 'crm' | 'calendar' | 'billing';
  provider: string;
  status: 'connected' | 'disconnected' | 'error' | 'connecting' | 'validating';
  config: Record<string, any>;
  securityConfig: SecurityConfig;
  healthCheck: HealthCheckConfig;
  retryPolicy: RetryConfig;
  version: string;
}

// Constants
const INTEGRATION_TYPES = {
  CRM: 'crm' as const,
  CALENDAR: 'calendar' as const,
  BILLING: 'billing' as const,
};

const INTEGRATION_STATUS = {
  CONNECTED: 'connected' as const,
  DISCONNECTED: 'disconnected' as const,
  ERROR: 'error' as const,
  CONNECTING: 'connecting' as const,
  VALIDATING: 'validating' as const,
};

const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_DELAY: 1000,
  MAX_DELAY: 5000,
  BACKOFF_FACTOR: 2,
};

const HEALTH_CHECK_CONFIG = {
  INTERVAL: 60000,
  TIMEOUT: 5000,
  THRESHOLD: 3,
};

// Custom hook for managing integrations
const useIntegrations = () => {
  const logger = useLogger('integrations');

  const { data: integrations, isLoading, error, refetch } = useQuery<IntegrationConfig[]>(
    ['integrations'],
    async () => {
      const response = await fetch('/api/v1/integrations');
      if (!response.ok) {
        throw new Error('Failed to fetch integrations');
      }
      return response.json();
    },
    {
      staleTime: 30000,
      cacheTime: 300000,
      retry: RETRY_CONFIG.MAX_RETRIES,
      onError: (error) => {
        logger.error('Failed to fetch integrations', { error });
      },
    }
  );

  const updateIntegration = useCallback(async (
    id: string,
    updates: Partial<IntegrationConfig>
  ) => {
    try {
      const response = await fetch(`/api/v1/integrations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update integration');
      }

      await refetch();
      logger.info('Integration updated successfully', { id, updates });
    } catch (error) {
      logger.error('Error updating integration', { error, id });
      throw error;
    }
  }, [refetch, logger]);

  const testConnection = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/v1/integrations/${id}/test`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Connection test failed');
      }

      const result = await response.json();
      logger.info('Connection test completed', { id, result });
      return result;
    } catch (error) {
      logger.error('Connection test failed', { error, id });
      throw error;
    }
  }, [logger]);

  return {
    integrations,
    isLoading,
    error,
    updateIntegration,
    testConnection,
  };
};

// Main component
const IntegrationsPage: React.FC = () => {
  const { theme } = useTheme();
  const logger = useLogger('integrations-page');
  const {
    integrations,
    isLoading,
    error,
    updateIntegration,
    testConnection,
  } = useIntegrations();

  const [activeIntegration, setActiveIntegration] = useState<string | null>(null);

  const handleConfigUpdate = async (
    id: string,
    updates: Partial<IntegrationConfig>
  ) => {
    try {
      await updateIntegration(id, updates);
      BlitzyUI.Toast.success('Integration updated successfully');
    } catch (error) {
      BlitzyUI.Toast.error('Failed to update integration');
      logger.error('Integration update failed', { error, id });
    }
  };

  const handleConnectionTest = async (id: string) => {
    try {
      setActiveIntegration(id);
      await testConnection(id);
      BlitzyUI.Toast.success('Connection test successful');
    } catch (error) {
      BlitzyUI.Toast.error('Connection test failed');
      logger.error('Connection test failed', { error, id });
    } finally {
      setActiveIntegration(null);
    }
  };

  const renderIntegrationCard = (integration: IntegrationConfig) => (
    <Card
      key={integration.id}
      variant="elevated"
      className="mb-4"
    >
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-semibold">{integration.provider}</h3>
          <p className="text-sm text-textSecondary">{integration.type}</p>
        </div>
        <BlitzyUI.Badge
          variant={integration.status === INTEGRATION_STATUS.CONNECTED ? 'success' : 'error'}
        >
          {integration.status}
        </BlitzyUI.Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <h4 className="text-sm font-medium mb-2">Security Configuration</h4>
          <BlitzyUI.Toggle
            label="Encryption"
            checked={integration.securityConfig.encryptionEnabled}
            onChange={(checked) => handleConfigUpdate(integration.id, {
              securityConfig: { ...integration.securityConfig, encryptionEnabled: checked }
            })}
          />
          <BlitzyUI.Toggle
            label="API Key Rotation"
            checked={integration.securityConfig.apiKeyRotation}
            onChange={(checked) => handleConfigUpdate(integration.id, {
              securityConfig: { ...integration.securityConfig, apiKeyRotation: checked }
            })}
          />
        </div>

        <div>
          <h4 className="text-sm font-medium mb-2">Health Monitoring</h4>
          <BlitzyUI.Toggle
            label="Health Checks"
            checked={integration.healthCheck.enabled}
            onChange={(checked) => handleConfigUpdate(integration.id, {
              healthCheck: { ...integration.healthCheck, enabled: checked }
            })}
          />
          <BlitzyUI.Input
            type="number"
            label="Check Interval (ms)"
            value={integration.healthCheck.interval}
            onChange={(value) => handleConfigUpdate(integration.id, {
              healthCheck: { ...integration.healthCheck, interval: parseInt(value) }
            })}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <BlitzyUI.Button
          variant="secondary"
          onClick={() => handleConnectionTest(integration.id)}
          loading={activeIntegration === integration.id}
        >
          Test Connection
        </BlitzyUI.Button>
        <BlitzyUI.Button
          variant="primary"
          onClick={() => handleConfigUpdate(integration.id, {
            status: integration.status === INTEGRATION_STATUS.CONNECTED
              ? INTEGRATION_STATUS.DISCONNECTED
              : INTEGRATION_STATUS.CONNECTING
          })}
        >
          {integration.status === INTEGRATION_STATUS.CONNECTED ? 'Disconnect' : 'Connect'}
        </BlitzyUI.Button>
      </div>
    </Card>
  );

  return (
    <Layout
      title="Integration Settings"
      subtitle="Manage external service connections"
    >
      <ErrorBoundary>
        <div className="max-w-4xl mx-auto">
          {isLoading ? (
            <BlitzyUI.Spinner size="large" />
          ) : error ? (
            <BlitzyUI.Alert
              type="error"
              title="Error loading integrations"
              message="Please try again later"
            />
          ) : (
            <div>
              {integrations?.map(renderIntegrationCard)}
            </div>
          )}
        </div>
      </ErrorBoundary>
    </Layout>
  );
};

export default IntegrationsPage;