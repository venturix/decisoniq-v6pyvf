/**
 * Redux selectors for customer success metrics state management
 * Implements memoized selectors for optimal performance and data validation
 * @version 1.0.0
 * @package @customer-success-ai/web
 */

import { createSelector } from 'reselect'; // ^4.1.8
import type { RootState } from '../rootReducer';
import type {
  MetricsState,
  MetricsTimeRange,
  MetricsFilter,
  CustomerMetric,
  AggregateMetric,
  DataQuality,
  MetricType,
  MetricTrend
} from './types';

/**
 * Base selector for accessing metrics state with null safety
 */
export const selectMetricsState = (state: RootState): MetricsState => state.metrics;

/**
 * Memoized selector for customer metrics with time range filtering
 */
export const selectCustomerMetrics = createSelector(
  [selectMetricsState, (_, timeRange?: MetricsTimeRange) => timeRange],
  (metricsState, timeRange): Record<string, CustomerMetric[]> => {
    const { customerMetrics } = metricsState;

    if (!timeRange) {
      return customerMetrics;
    }

    return Object.entries(customerMetrics).reduce((filtered, [customerId, metrics]) => {
      filtered[customerId] = metrics.filter(metric => {
        const timestamp = new Date(metric.timestamp).getTime();
        return timestamp >= timeRange.start && timestamp <= timeRange.end;
      });
      return filtered;
    }, {} as Record<string, CustomerMetric[]>);
  }
);

/**
 * Memoized selector for aggregate metrics with performance validation
 */
export const selectAggregateMetrics = createSelector(
  [selectMetricsState],
  (metricsState): Record<string, AggregateMetric> => {
    const { aggregateMetrics } = metricsState;

    // Validate against target thresholds
    return Object.entries(aggregateMetrics).reduce((validated, [key, metric]) => {
      const trend = calculateMetricTrend(metric);
      validated[key] = {
        ...metric,
        trend,
        metadata: {
          ...metric.metadata,
          meetsTarget: metric.current >= metric.target,
          performance: calculatePerformanceRatio(metric)
        }
      };
      return validated;
    }, {} as Record<string, AggregateMetric>);
  }
);

/**
 * Factory function for creating customer-specific metric selectors
 */
export const selectCustomerMetricsById = (
  customerId: string,
  timeRange?: MetricsTimeRange
) => createSelector(
  [selectCustomerMetrics],
  (customerMetrics): CustomerMetric[] => {
    const metrics = customerMetrics[customerId] || [];
    if (!timeRange) {
      return metrics;
    }

    return metrics.filter(metric => {
      const timestamp = new Date(metric.timestamp).getTime();
      return timestamp >= timeRange.start && timestamp <= timeRange.end;
    });
  }
);

/**
 * Selector for metrics data quality assessment
 */
export const selectMetricsDataQuality = createSelector(
  [selectMetricsState],
  (metricsState): DataQuality => metricsState.validationState.dataQuality
);

/**
 * Selector for critical performance metrics
 */
export const selectCriticalMetrics = createSelector(
  [selectAggregateMetrics],
  (aggregateMetrics): AggregateMetric[] => {
    return Object.values(aggregateMetrics).filter(metric => {
      const performanceRatio = calculatePerformanceRatio(metric);
      return performanceRatio < 0.7 || metric.trend === MetricTrend.WORSENING;
    });
  }
);

/**
 * Selector for retention-related metrics
 */
export const selectRetentionMetrics = createSelector(
  [selectAggregateMetrics],
  (aggregateMetrics): AggregateMetric => {
    return {
      type: MetricType.RETENTION_RATE,
      current: aggregateMetrics[MetricType.RETENTION_RATE]?.current || 0,
      previous: aggregateMetrics[MetricType.RETENTION_RATE]?.previous || 0,
      target: 0.85, // 85% retention target
      trend: calculateMetricTrend(aggregateMetrics[MetricType.RETENTION_RATE])
    };
  }
);

/**
 * Helper function to calculate metric performance ratio
 */
const calculatePerformanceRatio = (metric: AggregateMetric): number => {
  if (!metric.target || metric.target === 0) {
    return 1;
  }
  return metric.current / metric.target;
};

/**
 * Helper function to calculate metric trend
 */
const calculateMetricTrend = (metric: AggregateMetric): MetricTrend => {
  if (!metric || !metric.previous) {
    return MetricTrend.STABLE;
  }

  const changePercent = ((metric.current - metric.previous) / metric.previous) * 100;

  if (changePercent >= 5) {
    return MetricTrend.IMPROVING;
  } else if (changePercent <= -5) {
    return MetricTrend.WORSENING;
  }

  return MetricTrend.STABLE;
};