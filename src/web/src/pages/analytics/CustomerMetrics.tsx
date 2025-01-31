import React from 'react';
import { useQuery } from '@tanstack/react-query'; // ^4.0.0
import { Card, Grid, Typography } from '@blitzy/premium-ui'; // ^2.0.0
import MetricsCard from '../../components/analytics/MetricsCard';
import ChartContainer from '../../components/analytics/ChartContainer';
import CustomerHealthChart from '../../components/analytics/CustomerHealthChart';
import { useCustomer } from '../../hooks/useCustomer';
import { MetricType, MetricTrend } from '../../types/metrics';
import { useTheme } from '../../lib/blitzy/theme';

/**
 * Props interface for CustomerMetrics component
 */
interface CustomerMetricsProps {
  customerId: string;
  timeRange?: number;
  refreshInterval?: number;
  enableExport?: boolean;
}

/**
 * CustomerMetrics component that displays comprehensive customer analytics
 * Implements WCAG 2.1 Level AA compliance and Blitzy Enterprise Design System
 */
const CustomerMetrics: React.FC<CustomerMetricsProps> = ({
  customerId,
  timeRange = 30,
  refreshInterval = 5000,
  enableExport = true,
}) => {
  const { theme } = useTheme();
  const {
    selectedCustomer,
    healthScore,
    loadingState,
    error,
    selectCustomerById,
    refreshHealthScore,
  } = useCustomer({
    autoLoad: true,
    refreshInterval,
    cacheTimeout: 300000, // 5 minutes
  });

  // Load customer data on mount or when customerId changes
  React.useEffect(() => {
    selectCustomerById(customerId);
  }, [customerId, selectCustomerById]);

  // Fetch metrics data with caching and real-time updates
  const { data: metrics, isLoading: metricsLoading } = useQuery(
    ['customerMetrics', customerId],
    async () => {
      const response = await fetch(`/api/v1/customers/${customerId}/metrics`);
      if (!response.ok) throw new Error('Failed to fetch metrics');
      return response.json();
    },
    {
      refetchInterval: refreshInterval,
      staleTime: refreshInterval / 2,
      cacheTime: 300000, // 5 minutes
      retry: 3,
    }
  );

  // Handle export functionality
  const handleExport = React.useCallback(async () => {
    try {
      const response = await fetch(
        `/api/v1/customers/${customerId}/metrics/export`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ timeRange }),
        }
      );
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `customer-metrics-${customerId}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
    }
  }, [customerId, timeRange]);

  // Render loading state
  if (loadingState === 'loading' || metricsLoading) {
    return (
      <div role="status" aria-label="Loading metrics">
        <Typography variant="h2">Loading customer metrics...</Typography>
      </div>
    );
  }

  // Render error state
  if (error || loadingState === 'error') {
    return (
      <div role="alert" aria-label="Error loading metrics">
        <Typography variant="h2" color="error">
          Error loading metrics: {error?.message || 'Unknown error'}
        </Typography>
      </div>
    );
  }

  return (
    <div className="customer-metrics" role="main" aria-label="Customer Metrics Dashboard">
      {/* Header Section */}
      <div className="customer-metrics__header">
        <Typography variant="h1" className="mb-4">
          {selectedCustomer?.name} - Performance Metrics
        </Typography>
        
        {enableExport && (
          <button
            onClick={handleExport}
            className="export-button"
            aria-label="Export metrics data"
          >
            Export Data
          </button>
        )}
      </div>

      {/* Key Metrics Grid */}
      <Grid container spacing={3} className="mb-6">
        <Grid item xs={12} md={6} lg={3}>
          <MetricsCard
            type={MetricType.HEALTH_SCORE}
            metric={{
              type: MetricType.HEALTH_SCORE,
              current: healthScore || 0,
              previous: metrics?.previousHealthScore || 0,
              target: 85,
              trend: metrics?.healthScoreTrend || MetricTrend.STABLE,
            }}
            title="Health Score"
            description="Overall customer health indicator"
          />
        </Grid>

        <Grid item xs={12} md={6} lg={3}>
          <MetricsCard
            type={MetricType.CHURN_RATE}
            metric={{
              type: MetricType.CHURN_RATE,
              current: metrics?.churnRate || 0,
              previous: metrics?.previousChurnRate || 0,
              target: 0.05,
              trend: metrics?.churnTrend || MetricTrend.STABLE,
            }}
            title="Churn Risk"
            description="Predicted customer churn probability"
          />
        </Grid>

        <Grid item xs={12} md={6} lg={3}>
          <MetricsCard
            type={MetricType.REVENUE_IMPACT}
            metric={{
              type: MetricType.REVENUE_IMPACT,
              current: metrics?.revenueImpact || 0,
              previous: metrics?.previousRevenueImpact || 0,
              target: metrics?.revenueTarget || 100000,
              trend: metrics?.revenueTrend || MetricTrend.STABLE,
            }}
            title="Revenue Impact"
            description="Projected revenue impact based on current trends"
          />
        </Grid>

        <Grid item xs={12} md={6} lg={3}>
          <MetricsCard
            type={MetricType.OPERATIONAL_EFFICIENCY}
            metric={{
              type: MetricType.OPERATIONAL_EFFICIENCY,
              current: metrics?.efficiency || 0,
              previous: metrics?.previousEfficiency || 0,
              target: 0.95,
              trend: metrics?.efficiencyTrend || MetricTrend.STABLE,
            }}
            title="Operational Efficiency"
            description="Customer success team efficiency score"
          />
        </Grid>
      </Grid>

      {/* Charts Section */}
      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <CustomerHealthChart
            customerId={customerId}
            timeRange={timeRange}
            height={400}
            refreshInterval={refreshInterval}
          />
        </Grid>

        <Grid item xs={12} lg={4}>
          <ChartContainer
            title="Risk Factors"
            height={400}
            loading={metricsLoading}
            error={error?.message}
          >
            {metrics?.riskFactors && (
              <div className="risk-factors">
                {/* Risk factors visualization implementation */}
              </div>
            )}
          </ChartContainer>
        </Grid>
      </Grid>
    </div>
  );
};

CustomerMetrics.displayName = 'CustomerMetrics';

export default React.memo(CustomerMetrics);