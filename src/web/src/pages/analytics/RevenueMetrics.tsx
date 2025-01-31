import React from 'react';
import { useSelector } from 'react-redux';
import { PageBuilder } from '@blitzy/premium-ui'; // ^2.0.0
import RevenueImpactChart from '../../components/analytics/RevenueImpactChart';
import { MetricsCard } from '../../components/analytics/MetricsCard';
import { selectAggregateMetrics } from '../../store/metrics/selectors';
import { MetricType } from '../../types/metrics';
import { useTheme } from '../../hooks/useTheme';

/**
 * Enhanced custom hook for managing revenue metrics data with validation
 */
const useRevenueMetrics = () => {
  const metrics = useSelector(selectAggregateMetrics);

  // Extract relevant revenue metrics
  const revenueImpact = metrics[MetricType.REVENUE_IMPACT];
  const expansionRevenue = metrics[MetricType.EXPANSION_REVENUE];
  const retentionRate = metrics[MetricType.RETENTION_RATE];

  return {
    revenueImpact,
    expansionRevenue,
    retentionRate,
    isLoading: !metrics || !revenueImpact,
    hasData: Boolean(revenueImpact && expansionRevenue && retentionRate)
  };
};

/**
 * Revenue Metrics Page Component
 * Displays comprehensive revenue analytics with enhanced accessibility
 */
const RevenueMetrics: React.FC = () => {
  const { theme } = useTheme();
  const {
    revenueImpact,
    expansionRevenue,
    retentionRate,
    isLoading,
    hasData
  } = useRevenueMetrics();

  return (
    <PageBuilder
      title="Revenue Analytics"
      description="Comprehensive revenue metrics and financial performance indicators"
      className="revenue-metrics"
      layout="dashboard"
      aria-label="Revenue metrics dashboard"
    >
      {/* Revenue Impact Overview Section */}
      <section
        className="revenue-metrics__overview"
        aria-labelledby="revenue-overview-title"
      >
        <h2 
          id="revenue-overview-title"
          className="revenue-metrics__section-title"
        >
          Revenue Impact Overview
        </h2>

        <div className="revenue-metrics__cards">
          {/* Revenue Impact Card */}
          <MetricsCard
            type={MetricType.REVENUE_IMPACT}
            metric={revenueImpact}
            title="Revenue Impact"
            description="Total financial impact from customer retention and expansion"
            loading={isLoading}
            showTrendLine
            className="revenue-metrics__card"
          />

          {/* Expansion Revenue Card */}
          <MetricsCard
            type={MetricType.EXPANSION_REVENUE}
            metric={expansionRevenue}
            title="Expansion Revenue"
            description="Additional revenue from existing customer growth"
            loading={isLoading}
            showTrendLine
            className="revenue-metrics__card"
          />

          {/* Retention Rate Card */}
          <MetricsCard
            type={MetricType.RETENTION_RATE}
            metric={retentionRate}
            title="Retention Rate"
            description="Percentage of customers retained over time"
            loading={isLoading}
            showTrendLine
            className="revenue-metrics__card"
          />
        </div>
      </section>

      {/* Revenue Impact Analysis Section */}
      <section
        className="revenue-metrics__analysis"
        aria-labelledby="revenue-analysis-title"
      >
        <h2 
          id="revenue-analysis-title"
          className="revenue-metrics__section-title"
        >
          Revenue Impact Analysis
        </h2>

        <div className="revenue-metrics__chart-container">
          <RevenueImpactChart
            className="revenue-metrics__chart"
            height={400}
            ariaLabel="Revenue impact trend analysis chart"
          />
        </div>
      </section>

      {/* No Data State */}
      {!isLoading && !hasData && (
        <div 
          className="revenue-metrics__no-data"
          role="alert"
          aria-live="polite"
        >
          <p>No revenue metrics data available. Please check your data sources or try again later.</p>
        </div>
      )}

      <style jsx>{`
        .revenue-metrics {
          padding: 24px;
          max-width: 1440px;
          margin: 0 auto;
        }

        .revenue-metrics__section-title {
          font-size: 1.5rem;
          font-weight: 600;
          color: ${theme.mode === 'dark' ? '#FFFFFF' : '#000000'};
          margin-bottom: 1.5rem;
        }

        .revenue-metrics__cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 24px;
          margin-bottom: 48px;
        }

        .revenue-metrics__chart-container {
          background: ${theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)'};
          border-radius: 8px;
          padding: 24px;
          margin-bottom: 48px;
        }

        .revenue-metrics__no-data {
          text-align: center;
          padding: 48px;
          background: ${theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)'};
          border-radius: 8px;
          color: ${theme.mode === 'dark' ? '#FFFFFF' : '#000000'};
        }

        @media (max-width: 768px) {
          .revenue-metrics {
            padding: 16px;
          }

          .revenue-metrics__cards {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </PageBuilder>
  );
};

RevenueMetrics.displayName = 'RevenueMetrics';

export default RevenueMetrics;