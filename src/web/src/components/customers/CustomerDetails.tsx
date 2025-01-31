/**
 * CustomerDetails Component
 * Enterprise-grade React component for displaying detailed customer information
 * @version 1.0.0
 * @package @customer-success-ai/web
 */

import React, { useEffect, useCallback, memo } from 'react'; // ^18.0.0
import { io, Socket } from 'socket.io-client'; // ^4.0.0
import type { Customer, CustomerRiskLevel, CustomerRiskProfile, CustomerMetadata } from '../../types/customer';
import { useCustomer } from '../../hooks/useCustomer';

/**
 * Props interface for CustomerDetails component
 */
interface CustomerDetailsProps {
  customerId: string;
  className?: string;
  onError?: (error: Error) => void;
}

/**
 * Formats health score with accessibility metadata
 */
const formatHealthScore = (score: number) => {
  const value = Math.round(score);
  let color: string;
  let ariaLabel: string;

  switch (true) {
    case value >= 80:
      color = 'var(--color-success-600)';
      ariaLabel = `Excellent health score of ${value}`;
      break;
    case value >= 60:
      color = 'var(--color-warning-500)';
      ariaLabel = `Good health score of ${value}`;
      break;
    case value >= 40:
      color = 'var(--color-warning-600)';
      ariaLabel = `Fair health score of ${value}`;
      break;
    default:
      color = 'var(--color-danger-600)';
      ariaLabel = `Critical health score of ${value}`;
  }

  return { value: `${value}%`, color, ariaLabel };
};

/**
 * Formats risk level with severity indicators
 */
const formatRiskLevel = (riskProfile: CustomerRiskProfile) => {
  const severity: Record<CustomerRiskLevel, string> = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
  };

  const level = riskProfile.level;
  const ariaLabel = `Risk level is ${level.toLowerCase()} with ${riskProfile.factors.length} contributing factors`;

  return {
    level: level.toLowerCase(),
    severity: severity[level],
    ariaLabel
  };
};

/**
 * CustomerDetails component for displaying comprehensive customer information
 */
const CustomerDetails: React.FC<CustomerDetailsProps> = memo(({ 
  customerId,
  className = '',
  onError
}) => {
  const {
    selectedCustomer,
    healthScore,
    refreshHealthScore,
    error,
    selectCustomerById
  } = useCustomer({
    autoLoad: true,
    refreshInterval: 30000, // 30 second refresh
    cacheTimeout: 300000    // 5 minute cache
  });

  // WebSocket connection for real-time updates
  const socketRef = React.useRef<Socket>();

  /**
   * Initialize WebSocket connection
   */
  const initializeSocket = useCallback(() => {
    socketRef.current = io('/customer-events', {
      auth: { customerId },
      reconnectionAttempts: 3,
      reconnectionDelay: 1000
    });

    socketRef.current.on('health-score-update', (data: { score: number }) => {
      refreshHealthScore(customerId);
    });

    socketRef.current.on('risk-profile-update', () => {
      selectCustomerById(customerId);
    });

    socketRef.current.on('connect_error', (err) => {
      onError?.(new Error(`WebSocket connection failed: ${err.message}`));
    });
  }, [customerId, refreshHealthScore, selectCustomerById, onError]);

  // Initialize customer data and socket connection
  useEffect(() => {
    selectCustomerById(customerId);
    initializeSocket();

    return () => {
      socketRef.current?.disconnect();
    };
  }, [customerId, selectCustomerById, initializeSocket]);

  // Error handling
  useEffect(() => {
    if (error) {
      onError?.(error);
    }
  }, [error, onError]);

  if (!selectedCustomer) {
    return (
      <div className={`customer-details-skeleton ${className}`} role="alert" aria-busy="true">
        <div className="loading-placeholder" aria-label="Loading customer details" />
      </div>
    );
  }

  const formattedHealth = formatHealthScore(healthScore || selectedCustomer.healthScore);
  const formattedRisk = formatRiskLevel(selectedCustomer.riskProfile);

  return (
    <div 
      className={`customer-details ${className}`}
      data-testid="customer-details"
      aria-label={`Customer details for ${selectedCustomer.name}`}
    >
      {/* Customer Header */}
      <header className="customer-details-header">
        <h1 className="text-2xl font-bold">{selectedCustomer.name}</h1>
        <div className="customer-metrics" role="group" aria-label="Key metrics">
          <div 
            className="health-score"
            style={{ color: formattedHealth.color }}
            aria-label={formattedHealth.ariaLabel}
          >
            {formattedHealth.value}
          </div>
          <div 
            className={`risk-level risk-${formattedRisk.severity}`}
            aria-label={formattedRisk.ariaLabel}
          >
            {formattedRisk.level}
          </div>
        </div>
      </header>

      {/* Usage Metrics */}
      <section className="metrics-section" aria-label="Usage metrics">
        <h2 className="text-xl">Usage Metrics</h2>
        <div className="metrics-grid">
          <MetricCard
            label="Active Users"
            value={selectedCustomer.metadata.usageMetrics.activeUsers}
            trend={selectedCustomer.riskProfile.trend}
          />
          <MetricCard
            label="Feature Adoption"
            value={`${selectedCustomer.metadata.usageMetrics.featureAdoption['core'] || 0}%`}
            trend={selectedCustomer.riskProfile.trend}
          />
          <MetricCard
            label="API Usage"
            value={selectedCustomer.metadata.usageMetrics.apiUsage}
            trend={selectedCustomer.riskProfile.trend}
          />
        </div>
      </section>

      {/* Engagement Metrics */}
      <section className="metrics-section" aria-label="Engagement metrics">
        <h2 className="text-xl">Engagement</h2>
        <div className="metrics-grid">
          <MetricCard
            label="NPS Score"
            value={selectedCustomer.metadata.engagementMetrics.npsScore || 'N/A'}
            trend={selectedCustomer.riskProfile.trend}
          />
          <MetricCard
            label="Training Completion"
            value={`${selectedCustomer.metadata.engagementMetrics.trainingCompletion}%`}
            trend={selectedCustomer.riskProfile.trend}
          />
        </div>
      </section>

      {/* Risk Factors */}
      <section className="risk-factors" aria-label="Risk factors">
        <h2 className="text-xl">Risk Factors</h2>
        <ul className="risk-factors-list">
          {selectedCustomer.riskProfile.factors.map((factor, index) => (
            <li 
              key={`${factor.name}-${index}`}
              className={`risk-factor-item risk-${factor.category.toLowerCase()}`}
              aria-label={`${factor.name} risk factor with ${factor.impact} impact`}
            >
              <span className="factor-name">{factor.name}</span>
              <span className="factor-impact">{factor.impact}</span>
              <span className="factor-trend">{factor.trend.toLowerCase()}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
});

/**
 * MetricCard subcomponent for displaying individual metrics
 */
interface MetricCardProps {
  label: string;
  value: string | number;
  trend: string;
}

const MetricCard: React.FC<MetricCardProps> = memo(({ label, value, trend }) => (
  <div 
    className="metric-card"
    aria-label={`${label}: ${value}`}
  >
    <div className="metric-label">{label}</div>
    <div className="metric-value">{value}</div>
    <div className={`metric-trend trend-${trend.toLowerCase()}`}>
      {trend}
    </div>
  </div>
));

MetricCard.displayName = 'MetricCard';
CustomerDetails.displayName = 'CustomerDetails';

export default CustomerDetails;