/**
 * Redux action creators for managing customer success metrics state
 * Implements enterprise-grade state management with enhanced caching and validation
 * @version 1.0.0
 * @package @customer-success-ai/web
 */

import { ThunkAction, ThunkDispatch } from 'redux-thunk'; // ^2.4.2
import {
  MetricsActionTypes,
  MetricsAction,
} from './types';
import { CustomerMetric } from '../../types/metrics';
import metricsApi from '../../lib/api/metrics';
import { PERFORMANCE_THRESHOLDS } from '../../config/constants';

// Cache configuration
const METRICS_CACHE = new Map<string, {
  data: any;
  timestamp: number;
}>();

/**
 * Action creator for initiating metrics fetch request
 * Includes request tracking and performance monitoring
 */
export const fetchMetricsRequest = (): MetricsAction => ({
  type: MetricsActionTypes.FETCH_METRICS_REQUEST,
  payload: {
    requestId: crypto.randomUUID(),
    timestamp: Date.now()
  }
});

/**
 * Action creator for successful metrics fetch with validation
 */
export const fetchMetricsSuccess = (
  customerMetrics: Record<string, CustomerMetric[]>,
  aggregateMetrics: Record<string, any>,
  dataQuality: number
): MetricsAction => ({
  type: MetricsActionTypes.FETCH_METRICS_SUCCESS,
  payload: {
    customerMetrics,
    aggregateMetrics,
    dataQuality,
    timestamp: Date.now()
  }
});

/**
 * Action creator for metrics fetch failure with detailed error context
 */
export const fetchMetricsFailure = (error: any): MetricsAction => ({
  type: MetricsActionTypes.FETCH_METRICS_FAILURE,
  payload: {
    error: {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'An unknown error occurred',
      details: error.details || {},
      timestamp: Date.now()
    }
  }
});

/**
 * Action creator for updating customer-specific metrics
 */
export const updateCustomerMetrics = (
  customerId: string,
  metrics: CustomerMetric[]
): MetricsAction => ({
  type: MetricsActionTypes.UPDATE_CUSTOMER_METRICS,
  payload: {
    customerId,
    metrics,
    timestamp: Date.now()
  }
});

/**
 * Action creator for updating aggregate metrics with validation
 */
export const updateAggregateMetrics = (
  metrics: Record<string, any>
): MetricsAction => ({
  type: MetricsActionTypes.UPDATE_AGGREGATE_METRICS,
  payload: {
    metrics,
    timestamp: Date.now()
  }
});

/**
 * Action creator for metrics data validation
 */
export const validateMetricsData = (
  metrics: Record<string, any>
): MetricsAction => ({
  type: MetricsActionTypes.VALIDATE_METRICS_DATA,
  payload: {
    isValid: validateMetrics(metrics),
    timestamp: Date.now()
  }
});

/**
 * Action creator for updating metrics quality indicators
 */
export const updateMetricsQuality = (
  qualityScore: number
): MetricsAction => ({
  type: MetricsActionTypes.UPDATE_METRICS_QUALITY,
  payload: {
    qualityScore,
    timestamp: Date.now()
  }
});

/**
 * Thunk action creator for fetching all metrics with enhanced error handling
 * Implements caching, validation, and performance monitoring
 */
export const fetchMetrics = (): ThunkAction<
  Promise<void>,
  any,
  unknown,
  MetricsAction
> => {
  return async (dispatch: ThunkDispatch<any, unknown, MetricsAction>) => {
    const cacheKey = 'all-metrics';
    const cached = METRICS_CACHE.get(cacheKey);

    // Check cache validity
    if (cached && (Date.now() - cached.timestamp) < PERFORMANCE_THRESHOLDS.CACHE_TTL * 1000) {
      dispatch(fetchMetricsSuccess(
        cached.data.customerMetrics,
        cached.data.aggregateMetrics,
        cached.data.qualityScore
      ));
      return;
    }

    dispatch(fetchMetricsRequest());

    try {
      // Fetch customer health metrics
      const customerHealth = await metricsApi.getCustomerHealth('all', {
        useCache: true,
        retryAttempts: 3
      });

      // Fetch aggregated metrics
      const aggregatedMetrics = await metricsApi.getAggregatedMetrics(
        'ALL',
        {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: new Date(),
          interval: 'DAILY'
        },
        { validateData: true }
      );

      // Calculate revenue impact
      const revenueImpact = await metricsApi.calculateRevenueImpact(
        'all',
        {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: new Date(),
          interval: 'DAILY'
        }
      );

      // Validate data quality
      const qualityScore = calculateDataQuality({
        customerHealth,
        aggregatedMetrics,
        revenueImpact
      });

      const metricsData = {
        customerMetrics: customerHealth.data,
        aggregateMetrics: {
          ...aggregatedMetrics.data,
          revenueImpact: revenueImpact.data
        },
        qualityScore
      };

      // Update cache
      METRICS_CACHE.set(cacheKey, {
        data: metricsData,
        timestamp: Date.now()
      });

      dispatch(fetchMetricsSuccess(
        metricsData.customerMetrics,
        metricsData.aggregateMetrics,
        metricsData.qualityScore
      ));

    } catch (error: any) {
      dispatch(fetchMetricsFailure(error));
      console.error('Error fetching metrics:', error);
    }
  };
};

/**
 * Validates metrics data structure and values
 */
function validateMetrics(metrics: Record<string, any>): boolean {
  if (!metrics || typeof metrics !== 'object') {
    return false;
  }

  const requiredFields = ['value', 'timestamp', 'customerId'];
  return Object.values(metrics).every(metric => 
    requiredFields.every(field => metric.hasOwnProperty(field))
  );
}

/**
 * Calculates data quality score based on completeness and validity
 */
function calculateDataQuality(metrics: Record<string, any>): number {
  const weights = {
    completeness: 0.4,
    accuracy: 0.3,
    timeliness: 0.3
  };

  const completeness = calculateCompleteness(metrics);
  const accuracy = calculateAccuracy(metrics);
  const timeliness = calculateTimeliness(metrics);

  return (
    completeness * weights.completeness +
    accuracy * weights.accuracy +
    timeliness * weights.timeliness
  );
}

/**
 * Calculates data completeness score
 */
function calculateCompleteness(metrics: Record<string, any>): number {
  const requiredFields = ['value', 'timestamp', 'customerId'];
  let totalFields = 0;
  let validFields = 0;

  Object.values(metrics).forEach(metric => {
    requiredFields.forEach(field => {
      totalFields++;
      if (metric.hasOwnProperty(field) && metric[field] !== null) {
        validFields++;
      }
    });
  });

  return validFields / totalFields;
}

/**
 * Calculates data accuracy score
 */
function calculateAccuracy(metrics: Record<string, any>): number {
  let totalMetrics = 0;
  let validMetrics = 0;

  Object.values(metrics).forEach(metric => {
    totalMetrics++;
    if (
      typeof metric.value === 'number' &&
      !isNaN(metric.value) &&
      metric.value >= 0
    ) {
      validMetrics++;
    }
  });

  return validMetrics / totalMetrics;
}

/**
 * Calculates data timeliness score
 */
function calculateTimeliness(metrics: Record<string, any>): number {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  let totalMetrics = 0;
  let timelyMetrics = 0;

  Object.values(metrics).forEach(metric => {
    totalMetrics++;
    const age = now - new Date(metric.timestamp).getTime();
    if (age <= maxAge) {
      timelyMetrics++;
    }
  });

  return timelyMetrics / totalMetrics;
}