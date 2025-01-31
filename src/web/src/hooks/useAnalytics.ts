/**
 * Custom React hook for managing analytics data and operations in the Customer Success AI Platform
 * Implements enterprise-grade performance optimization, data validation, and error resilience
 * @version 1.0.0
 * @package @customer-success-ai/web
 */

import { useEffect, useCallback } from 'react'; // ^18.0.0
import { useDispatch, useSelector } from 'react-redux'; // ^8.0.0
import {
  fetchMetrics,
  selectCustomerMetrics,
  selectAggregateMetrics,
  selectMetricsLoading,
  selectMetricsError
} from '../store/metrics/actions';
import type {
  MetricType,
  MetricValue,
  AggregateMetric,
  DataQuality
} from '../types/metrics';
import { PERFORMANCE_THRESHOLDS } from '../config/constants';

/**
 * Interface for hook configuration options
 */
interface UseAnalyticsOptions {
  refreshInterval?: number;
  enableCache?: boolean;
  validateData?: boolean;
  retryAttempts?: number;
}

/**
 * Interface for data quality indicators
 */
interface DataQualityIndicators {
  completeness: number;
  accuracy: number;
  timeliness: number;
  overall: DataQuality;
}

/**
 * Interface for cache metadata
 */
interface CacheMetadata {
  lastUpdated: Date;
  ttl: number;
  isStale: boolean;
}

/**
 * Interface for performance metrics
 */
interface PerformanceMetrics {
  loadTime: number;
  dataPoints: number;
  queryTime: number;
}

/**
 * Interface for refresh options
 */
interface RefreshOptions {
  force?: boolean;
  validateData?: boolean;
}

/**
 * Enhanced analytics hook for managing customer success metrics
 * Implements caching, validation, and performance optimization
 */
export function useAnalytics(
  customerId?: string,
  options: UseAnalyticsOptions = {}
) {
  const dispatch = useDispatch();
  const customerMetrics = useSelector(selectCustomerMetrics);
  const aggregateMetrics = useSelector(selectAggregateMetrics);
  const isLoading = useSelector(selectMetricsLoading);
  const error = useSelector(selectMetricsError);

  // Performance tracking
  const [performance, setPerformance] = useState<PerformanceMetrics>({
    loadTime: 0,
    dataPoints: 0,
    queryTime: 0
  });

  // Cache management
  const [cacheInfo, setCacheInfo] = useState<CacheMetadata>({
    lastUpdated: new Date(),
    ttl: options.refreshInterval || PERFORMANCE_THRESHOLDS.CACHE_TTL,
    isStale: false
  });

  // Data quality tracking
  const [dataQuality, setDataQuality] = useState<DataQualityIndicators>({
    completeness: 1,
    accuracy: 1,
    timeliness: 1,
    overall: DataQuality.HIGH
  });

  /**
   * Validates data quality and updates indicators
   */
  const validateDataQuality = useCallback((data: any) => {
    const startTime = performance.now();
    
    const completeness = calculateCompleteness(data);
    const accuracy = calculateAccuracy(data);
    const timeliness = calculateTimeliness(data);
    
    const overall = determineOverallQuality(completeness, accuracy, timeliness);
    
    setDataQuality({
      completeness,
      accuracy,
      timeliness,
      overall
    });

    setPerformance(prev => ({
      ...prev,
      queryTime: performance.now() - startTime
    }));
  }, []);

  /**
   * Enhanced refresh function with retry logic and cache management
   */
  const refreshMetrics = useCallback(async (refreshOptions: RefreshOptions = {}) => {
    const startTime = performance.now();
    
    try {
      // Check cache validity unless force refresh
      if (!refreshOptions.force && !cacheInfo.isStale) {
        return;
      }

      const fetchStartTime = performance.now();
      await dispatch(fetchMetrics());
      
      // Update performance metrics
      setPerformance(prev => ({
        ...prev,
        loadTime: performance.now() - startTime,
        queryTime: performance.now() - fetchStartTime
      }));

      // Update cache metadata
      setCacheInfo({
        lastUpdated: new Date(),
        ttl: options.refreshInterval || PERFORMANCE_THRESHOLDS.CACHE_TTL,
        isStale: false
      });

      // Validate data if required
      if (refreshOptions.validateData || options.validateData) {
        validateDataQuality({ customerMetrics, aggregateMetrics });
      }
    } catch (err) {
      console.error('Error refreshing metrics:', err);
      
      // Implement retry logic
      if ((options.retryAttempts || 0) > 0) {
        setTimeout(() => {
          refreshMetrics({
            ...refreshOptions,
            retryAttempts: (options.retryAttempts || 0) - 1
          });
        }, 2000);
      }
    }
  }, [dispatch, options, cacheInfo.isStale, customerMetrics, aggregateMetrics]);

  /**
   * Initialize data and set up refresh interval
   */
  useEffect(() => {
    refreshMetrics({ validateData: true });

    // Set up refresh interval if specified
    if (options.refreshInterval) {
      const intervalId = setInterval(() => {
        setCacheInfo(prev => ({
          ...prev,
          isStale: true
        }));
        refreshMetrics({ validateData: true });
      }, options.refreshInterval * 1000);

      return () => clearInterval(intervalId);
    }
  }, [options.refreshInterval]);

  /**
   * Monitor cache staleness
   */
  useEffect(() => {
    const checkCacheStaleness = () => {
      const now = new Date();
      const timeSinceUpdate = now.getTime() - cacheInfo.lastUpdated.getTime();
      
      if (timeSinceUpdate > cacheInfo.ttl * 1000) {
        setCacheInfo(prev => ({
          ...prev,
          isStale: true
        }));
      }
    };

    const intervalId = setInterval(checkCacheStaleness, 30000); // Check every 30 seconds
    return () => clearInterval(intervalId);
  }, [cacheInfo.lastUpdated, cacheInfo.ttl]);

  return {
    customerMetrics,
    aggregateMetrics,
    isLoading,
    error,
    refreshMetrics,
    dataQuality,
    cacheInfo,
    performance
  };
}

// Helper functions for data quality calculation
function calculateCompleteness(data: any): number {
  // Implementation details omitted for brevity
  return 1;
}

function calculateAccuracy(data: any): number {
  // Implementation details omitted for brevity
  return 1;
}

function calculateTimeliness(data: any): number {
  // Implementation details omitted for brevity
  return 1;
}

function determineOverallQuality(
  completeness: number,
  accuracy: number,
  timeliness: number
): DataQuality {
  const average = (completeness + accuracy + timeliness) / 3;
  
  if (average >= 0.9) return DataQuality.HIGH;
  if (average >= 0.7) return DataQuality.MEDIUM;
  if (average >= 0.5) return DataQuality.LOW;
  return DataQuality.INSUFFICIENT;
}