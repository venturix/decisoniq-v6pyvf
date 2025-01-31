/**
 * Performance thresholds and acceptance criteria configuration for the Customer Success AI Platform
 * @version 1.0.0
 * @package @customer-success-ai/test
 */

import { TestEnvironment } from '../types/test';

/**
 * Interface defining comprehensive performance thresholds for system components
 */
export interface PerformanceThresholds {
  http: {
    /**
     * Maximum allowed duration for HTTP requests in milliseconds (target: sub-3s)
     */
    requestDuration: number;
    /**
     * Maximum acceptable failure rate to maintain 99.9% uptime
     */
    failureRate: number;
    /**
     * Required requests per second handling capacity
     */
    throughput: number;
    /**
     * Maximum concurrent users supported (target: 200)
     */
    concurrentUsers: number;
  };
  api: {
    healthScore: {
      /**
       * 95th percentile response time for health score calculations
       */
      p95ResponseTime: number;
      /**
       * Maximum allowed response time for any health score request
       */
      maxResponseTime: number;
      /**
       * Maximum acceptable error rate for health score API
       */
      errorRate: number;
    };
    riskAssessment: {
      /**
       * 95th percentile response time for risk assessments
       */
      p95ResponseTime: number;
      /**
       * Maximum allowed response time for risk assessment
       */
      maxResponseTime: number;
      /**
       * Maximum acceptable error rate for risk assessment API
       */
      errorRate: number;
    };
    playbooks: {
      /**
       * 95th percentile response time for playbook operations
       */
      p95ResponseTime: number;
      /**
       * Maximum allowed response time for playbook execution
       */
      maxResponseTime: number;
      /**
       * Maximum acceptable error rate for playbook API
       */
      errorRate: number;
    };
  };
  ml: {
    /**
     * Maximum allowed time for single prediction (target: sub-3s)
     */
    predictionLatency: number;
    /**
     * Maximum time for batch prediction processing
     */
    batchProcessingTime: number;
    /**
     * Minimum required prediction accuracy
     */
    accuracyThreshold: number;
    /**
     * Maximum allowed time for model loading
     */
    modelLoadTime: number;
  };
}

/**
 * Default performance thresholds aligned with system requirements
 */
export const defaultThresholds: PerformanceThresholds = {
  http: {
    requestDuration: 3000, // 3 seconds max
    failureRate: 0.001, // 99.9% uptime requirement
    throughput: 100, // Requests per second
    concurrentUsers: 200 // Enterprise user capacity
  },
  api: {
    healthScore: {
      p95ResponseTime: 1000,
      maxResponseTime: 3000,
      errorRate: 0.001
    },
    riskAssessment: {
      p95ResponseTime: 2000,
      maxResponseTime: 5000,
      errorRate: 0.001
    },
    playbooks: {
      p95ResponseTime: 1500,
      maxResponseTime: 4000,
      errorRate: 0.001
    }
  },
  ml: {
    predictionLatency: 2000, // 2 seconds for predictions
    batchProcessingTime: 30000, // 30 seconds for batch processing
    accuracyThreshold: 0.9, // 90% minimum accuracy
    modelLoadTime: 5000 // 5 seconds max for model loading
  }
};

/**
 * Returns environment-specific performance thresholds with appropriate adjustments
 * @param environment The deployment environment (development, staging, ci)
 * @returns Environment-specific performance thresholds
 */
export function getEnvironmentThresholds(environment: TestEnvironment): PerformanceThresholds {
  // Deep clone the default thresholds
  const thresholds: PerformanceThresholds = JSON.parse(JSON.stringify(defaultThresholds));

  // Apply environment-specific multipliers
  const multiplier = environment === 'development' ? 1.5 :
                    environment === 'staging' ? 1.2 : 1.0;

  // Adjust HTTP thresholds
  thresholds.http.requestDuration *= multiplier;
  thresholds.http.throughput = Math.floor(thresholds.http.throughput / multiplier);
  thresholds.http.concurrentUsers = Math.floor(thresholds.http.concurrentUsers / multiplier);

  // Adjust API thresholds
  Object.keys(thresholds.api).forEach(key => {
    const apiConfig = thresholds.api[key as keyof typeof thresholds.api];
    apiConfig.p95ResponseTime *= multiplier;
    apiConfig.maxResponseTime *= multiplier;
    // Adjust error rates based on environment
    apiConfig.errorRate = environment === 'development' ? 0.01 :
                         environment === 'staging' ? 0.005 : 0.001;
  });

  // Adjust ML thresholds
  thresholds.ml.predictionLatency *= multiplier;
  thresholds.ml.batchProcessingTime *= multiplier;
  thresholds.ml.modelLoadTime *= multiplier;
  // Adjust accuracy threshold based on environment
  thresholds.ml.accuracyThreshold = environment === 'development' ? 0.8 :
                                   environment === 'staging' ? 0.85 : 0.9;

  return thresholds;
}