/**
 * Analytics utility functions for the Customer Success AI Platform
 * Provides high-performance data processing and transformation capabilities
 * @version 1.0.0
 * @package @customer-success-ai/web
 */

import { format, parseISO } from 'date-fns'; // ^2.30.0
import { Chart, ChartConfiguration } from 'chart.js'; // ^4.0.0
import type {
  AnalyticsDashboard,
  AnalyticsWidget,
  WidgetConfig,
  WidgetData,
  TimeRange,
  DataSeries,
  WidgetType
} from '../types/analytics';
import type {
  CustomerMetric,
  AggregateMetric,
  MetricType,
  MetricThreshold,
  MetricTrend,
  DataQuality,
  TimeInterval
} from '../types/metrics';

/**
 * Statistical confidence level for trend calculations
 */
const CONFIDENCE_LEVEL = 0.95;

/**
 * Performance optimization constants
 */
const MAX_DATA_POINTS = 1000;
const CACHE_TTL = 300000; // 5 minutes in milliseconds

/**
 * Calculates metric trends with statistical significance and confidence intervals
 * @param metrics - Array of customer metrics to analyze
 * @param timeRange - Time range for trend calculation
 * @param threshold - Optional threshold for significance testing
 * @returns Comprehensive trend analysis with statistical insights
 */
export function calculateMetricTrend(
  metrics: CustomerMetric[],
  timeRange: TimeRange,
  threshold?: MetricThreshold
): {
  trend: MetricTrend;
  percentage: number;
  confidence: number;
  isSignificant: boolean;
} {
  if (!metrics.length) {
    throw new Error('No metrics provided for trend calculation');
  }

  // Sort metrics by timestamp for accurate analysis
  const sortedMetrics = [...metrics].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Calculate baseline and current periods
  const midPoint = Math.floor(sortedMetrics.length / 2);
  const baselinePeriod = sortedMetrics.slice(0, midPoint);
  const currentPeriod = sortedMetrics.slice(midPoint);

  // Calculate period averages
  const baselineAvg = baselinePeriod.reduce((sum, m) => sum + m.value, 0) / baselinePeriod.length;
  const currentAvg = currentPeriod.reduce((sum, m) => sum + m.value, 0) / currentPeriod.length;

  // Calculate percentage change
  const percentage = ((currentAvg - baselineAvg) / baselineAvg) * 100;

  // Calculate standard error for confidence interval
  const stdDev = calculateStandardDeviation(sortedMetrics.map(m => m.value));
  const standardError = stdDev / Math.sqrt(sortedMetrics.length);
  const confidence = standardError * 1.96; // 95% confidence interval

  // Determine statistical significance
  const isSignificant = Math.abs(percentage) > (threshold?.warning || 5);

  // Determine trend direction
  const trend = percentage > 0 ? MetricTrend.IMPROVING :
    percentage < 0 ? MetricTrend.WORSENING :
    MetricTrend.STABLE;

  return {
    trend,
    percentage: Number(percentage.toFixed(2)),
    confidence: Number(confidence.toFixed(2)),
    isSignificant
  };
}

/**
 * Formats metric values with internationalization and accessibility support
 * @param value - Numeric value to format
 * @param metricType - Type of metric for context-specific formatting
 * @param options - Optional formatting configuration
 * @returns Formatted value with accessibility metadata
 */
export function formatMetricValue(
  value: number,
  metricType: MetricType,
  options: {
    locale?: string;
    precision?: number;
    prefix?: string;
    suffix?: string;
  } = {}
): {
  formatted: string;
  ariaLabel: string;
  rawValue: number;
} {
  const {
    locale = 'en-US',
    precision = 2,
    prefix = '',
    suffix = ''
  } = options;

  // Handle special cases
  if (!Number.isFinite(value)) {
    return {
      formatted: 'N/A',
      ariaLabel: 'Value not available',
      rawValue: NaN
    };
  }

  // Format based on metric type
  let formatted = value.toLocaleString(locale, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision
  });

  // Add prefix/suffix based on metric type
  switch (metricType) {
    case MetricType.CHURN_RATE:
    case MetricType.RETENTION_RATE:
      formatted = `${formatted}%`;
      break;
    case MetricType.REVENUE_IMPACT:
    case MetricType.EXPANSION_REVENUE:
      formatted = `$${formatted}`;
      break;
  }

  // Apply custom prefix/suffix
  formatted = `${prefix}${formatted}${suffix}`;

  // Generate accessible label
  const ariaLabel = `${metricType.toLowerCase().replace('_', ' ')}: ${formatted}`;

  return {
    formatted,
    ariaLabel,
    rawValue: value
  };
}

/**
 * Transforms metrics into optimized chart data with advanced visualization features
 * @param metrics - Array of customer metrics to visualize
 * @param config - Widget configuration options
 * @param options - Chart-specific options
 * @returns Optimized chart data structure with accessibility features
 */
export function generateChartData(
  metrics: CustomerMetric[],
  config: WidgetConfig,
  options: {
    maxDataPoints?: number;
    colorScheme?: string[];
    enableAnimation?: boolean;
  } = {}
): ChartConfiguration {
  const {
    maxDataPoints = MAX_DATA_POINTS,
    colorScheme = ['#2563eb', '#7c3aed', '#db2777'],
    enableAnimation = true
  } = options;

  // Optimize data points for performance
  const optimizedMetrics = optimizeDataPoints(metrics, maxDataPoints);

  // Generate chart labels and datasets
  const labels = optimizedMetrics.map(m => 
    format(new Date(m.timestamp), 'MMM d, yyyy')
  );

  const datasets = [{
    data: optimizedMetrics.map(m => m.value),
    borderColor: colorScheme[0],
    backgroundColor: `${colorScheme[0]}33`,
    tension: 0.4,
    fill: true
  }];

  // Generate accessible tooltips
  const tooltips = {
    callbacks: {
      label: (context: any) => {
        const value = formatMetricValue(context.raw, config.chartType as MetricType);
        return value.ariaLabel;
      }
    }
  };

  return {
    type: config.chartType,
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: enableAnimation,
      plugins: {
        tooltip: tooltips,
        legend: {
          display: true,
          position: 'top'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value: number) => 
              formatMetricValue(value, config.chartType as MetricType).formatted
          }
        }
      }
    }
  };
}

/**
 * High-performance metric aggregation with statistical analysis
 * @param customerMetrics - Record of customer metrics by ID
 * @param options - Aggregation configuration options
 * @returns Comprehensive aggregation results with statistical insights
 */
export function aggregateMetrics(
  customerMetrics: Record<string, CustomerMetric[]>,
  options: {
    interval?: TimeInterval;
    quality?: DataQuality;
    includeOutliers?: boolean;
  } = {}
): AggregateMetric[] {
  const {
    interval = TimeInterval.DAILY,
    quality = DataQuality.HIGH,
    includeOutliers = false
  } = options;

  const results: AggregateMetric[] = [];

  // Process metrics in chunks for better performance
  const customerIds = Object.keys(customerMetrics);
  const chunkSize = 100;

  for (let i = 0; i < customerIds.length; i += chunkSize) {
    const chunk = customerIds.slice(i, i + chunkSize);
    
    // Process each customer's metrics
    chunk.forEach(customerId => {
      const metrics = customerMetrics[customerId];
      
      // Filter low-quality data points
      const filteredMetrics = metrics.filter(m => 
        !isLowQualityDataPoint(m, quality)
      );

      // Remove statistical outliers if specified
      const cleanedMetrics = includeOutliers ? 
        filteredMetrics : 
        removeOutliers(filteredMetrics);

      // Calculate aggregate statistics
      const aggregated = calculateAggregateStatistics(cleanedMetrics, interval);
      
      results.push(aggregated);
    });
  }

  return results;
}

/**
 * Helper function to calculate standard deviation
 */
function calculateStandardDeviation(values: number[]): number {
  const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squareDiffs = values.map(value => Math.pow(value - avg, 2));
  const avgSquareDiff = squareDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  return Math.sqrt(avgSquareDiff);
}

/**
 * Helper function to optimize data points for visualization
 */
function optimizeDataPoints(
  metrics: CustomerMetric[],
  maxPoints: number
): CustomerMetric[] {
  if (metrics.length <= maxPoints) return metrics;

  const interval = Math.ceil(metrics.length / maxPoints);
  return metrics.filter((_, index) => index % interval === 0);
}

/**
 * Helper function to identify low-quality data points
 */
function isLowQualityDataPoint(
  metric: CustomerMetric,
  threshold: DataQuality
): boolean {
  // Implementation of data quality checks
  return false; // Placeholder
}

/**
 * Helper function to remove statistical outliers
 */
function removeOutliers(metrics: CustomerMetric[]): CustomerMetric[] {
  // Implementation of outlier removal
  return metrics; // Placeholder
}

/**
 * Helper function to calculate aggregate statistics
 */
function calculateAggregateStatistics(
  metrics: CustomerMetric[],
  interval: TimeInterval
): AggregateMetric {
  // Implementation of statistical aggregation
  return {} as AggregateMetric; // Placeholder
}