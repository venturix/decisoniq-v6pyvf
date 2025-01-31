/**
 * API client module for interacting with Customer Success metrics endpoints
 * Implements enterprise-grade metrics retrieval with caching and error handling
 * @version 1.0.0
 * @axios ^1.6.0
 */

import axios from 'axios';
import { API_CONFIG } from '../../config/api';
import { MetricType } from '../../types/metrics';
import type {
  MetricValue,
  AggregateMetric,
  MetricResponse,
  AggregateMetricResponse,
  MetricTimeRange,
  InterventionMetrics,
  MetricDataPoint
} from '../../types/metrics';
import type { ApiError, ApiRequestConfig } from '../../types/api';

// Constants for metrics API configuration
const METRICS_BASE_URL = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.METRICS}`;
const CACHE_TTL = 300; // 5 minutes cache TTL
const MAX_RETRY_ATTEMPTS = 3;
const BATCH_SIZE = 50;

/**
 * Cache implementation for metrics data
 */
const metricsCache = new Map<string, {
  data: any;
  timestamp: number;
}>();

/**
 * Decorator for input validation
 */
function validateInput(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = function (...args: any[]) {
    if (!args[0]) {
      throw new Error('Required parameter missing');
    }
    return originalMethod.apply(this, args);
  };
  return descriptor;
}

/**
 * Decorator for response caching
 */
function cacheResponse(ttl: number = CACHE_TTL) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${propertyKey}-${JSON.stringify(args)}`;
      const cached = metricsCache.get(cacheKey);
      
      if (cached && (Date.now() - cached.timestamp) < ttl * 1000) {
        return cached.data;
      }

      const result = await originalMethod.apply(this, args);
      metricsCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      return result;
    };
    return descriptor;
  };
}

/**
 * Metrics API client with comprehensive error handling and caching
 */
class MetricsApiClient {
  /**
   * Retrieves customer health score with enhanced error handling
   */
  @validateInput
  @cacheResponse(300)
  async getCustomerHealth(
    customerId: string,
    options: { useCache?: boolean; retryAttempts?: number } = {}
  ): Promise<MetricResponse> {
    const config: ApiRequestConfig = {
      params: { customerId },
      timeout: API_CONFIG.TIMEOUT,
      headers: {
        'X-Request-Type': 'CustomerHealth'
      }
    };

    try {
      const response = await axios.get<MetricResponse>(
        `${METRICS_BASE_URL}/health/${customerId}`,
        config
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 429 && (options.retryAttempts || 0) < MAX_RETRY_ATTEMPTS) {
        const retryDelay = parseInt(error.response.headers['retry-after']) * 1000 || 5000;
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return this.getCustomerHealth(customerId, {
          ...options,
          retryAttempts: (options.retryAttempts || 0) + 1
        });
      }
      throw this.handleApiError(error);
    }
  }

  /**
   * Retrieves aggregated metrics with performance optimization
   */
  @validateInput
  async getAggregatedMetrics(
    metricType: MetricType,
    timeRange: MetricTimeRange,
    options: { batchSize?: number; validateData?: boolean } = {}
  ): Promise<AggregateMetricResponse> {
    const config: ApiRequestConfig = {
      params: {
        type: metricType,
        startDate: timeRange.start.toISOString(),
        endDate: timeRange.end.toISOString(),
        interval: timeRange.interval
      }
    };

    try {
      const response = await axios.get<AggregateMetricResponse>(
        `${METRICS_BASE_URL}/aggregate`,
        config
      );
      
      if (options.validateData) {
        this.validateMetricData(response.data);
      }
      
      return response.data;
    } catch (error: any) {
      throw this.handleApiError(error);
    }
  }

  /**
   * Calculates revenue impact with comprehensive analysis
   */
  async calculateRevenueImpact(
    customerId: string,
    timeRange: MetricTimeRange
  ): Promise<MetricResponse> {
    try {
      const response = await axios.post<MetricResponse>(
        `${METRICS_BASE_URL}/revenue-impact`,
        {
          customerId,
          startDate: timeRange.start.toISOString(),
          endDate: timeRange.end.toISOString()
        }
      );
      return response.data;
    } catch (error: any) {
      throw this.handleApiError(error);
    }
  }

  /**
   * Generates comprehensive metrics report
   */
  async generateReport(
    metrics: MetricType[],
    timeRange: MetricTimeRange
  ): Promise<MetricDataPoint[]> {
    try {
      const response = await axios.post<MetricResponse>(
        `${METRICS_BASE_URL}/report`,
        {
          metrics,
          startDate: timeRange.start.toISOString(),
          endDate: timeRange.end.toISOString(),
          interval: timeRange.interval
        }
      );
      return response.data.data as MetricDataPoint[];
    } catch (error: any) {
      throw this.handleApiError(error);
    }
  }

  /**
   * Validates metric data integrity
   */
  private validateMetricData(data: any): void {
    if (!data || !data.data) {
      throw new Error('Invalid metric data structure');
    }
    if (typeof data.data.value !== 'number') {
      throw new Error('Invalid metric value type');
    }
  }

  /**
   * Handles API errors with detailed context
   */
  private handleApiError(error: any): ApiError {
    const apiError: ApiError = {
      code: error.response?.data?.code || 'UNKNOWN_ERROR',
      message: error.response?.data?.message || 'An unknown error occurred',
      details: error.response?.data?.details || {},
      category: error.response?.data?.category || 'System',
      httpStatus: error.response?.status || 500
    };

    console.error('Metrics API Error:', apiError);
    return apiError;
  }
}

// Export singleton instance
export const metricsApi = new MetricsApiClient();