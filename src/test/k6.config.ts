/**
 * k6 load testing configuration for Customer Success AI Platform
 * Defines comprehensive test scenarios and thresholds for validating system performance requirements
 * @version 1.0.0
 * @package @customer-success-ai/test
 */

// External imports
import { Options } from 'k6/options'; // v0.45.0
import { SharedArray } from 'k6/data'; // v0.45.0

// Internal imports
import { PerformanceThresholds } from './src/config/performance-thresholds';
import { API_ENDPOINTS } from './src/performance/scenarios/api-endpoints';

/**
 * Default k6 test configuration with comprehensive scenarios and thresholds
 */
export const DEFAULT_OPTIONS: Options = {
  scenarios: {
    // API load testing scenario
    api_load_test: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '1m', target: 50 },    // Ramp up to 50 users
        { duration: '3m', target: 200 },   // Peak load of 200 users
        { duration: '1m', target: 0 }      // Ramp down
      ]
    },
    // ML prediction performance testing
    ml_prediction_test: {
      executor: 'constant-arrival-rate',
      rate: 100,                           // 100 iterations per second
      duration: '5m',                      // 5 minutes test duration
      preAllocatedVUs: 50                  // Pre-allocated virtual users
    },
    // Batch processing capacity testing
    batch_processing_test: {
      executor: 'per-vu-iterations',
      vus: 20,                            // 20 concurrent users
      iterations: 5000,                   // 5000 iterations per user
      maxDuration: '10m'                  // Maximum test duration
    }
  },
  thresholds: {
    // HTTP request thresholds
    'http_req_duration': ['p(95)<3000'],  // 95% of requests under 3s
    'http_req_failed': ['rate<0.001'],    // 99.9% success rate
    // Iteration duration thresholds
    'iteration_duration': ['p(90)<5000'],  // 90% of iterations under 5s
    // ML prediction thresholds
    'ml_prediction_duration': ['p(99)<3000'], // 99% of predictions under 3s
    // Batch processing thresholds
    'batch_processing_rate': ['rate>1000'] // Minimum 1000 events/second
  },
  // Test execution configuration
  userAgent: 'k6-load-test/1.0.0',
  batchSize: 1000,                        // Batch size for data processing
  maxRedirects: 4,
  noConnectionReuse: false,
  discardResponseBodies: true             // Optimize memory usage
};

/**
 * Generates environment and test-type specific k6 test configuration
 * @param environment Target test environment (development, staging, production)
 * @param testType Type of test to execute (api, ml, batch)
 * @returns Customized k6 test configuration
 */
export function getTestConfig(environment: string, testType: string): Options {
  // Deep clone default options
  const config: Options = JSON.parse(JSON.stringify(DEFAULT_OPTIONS));

  // Load environment-specific thresholds
  const thresholds: PerformanceThresholds = {
    http: {
      requestDuration: environment === 'development' ? 4500 : 3000,
      failureRate: environment === 'development' ? 0.005 : 0.001,
      throughput: environment === 'development' ? 50 : 100,
      concurrentUsers: environment === 'development' ? 100 : 200
    },
    api: {
      healthScore: {
        p95ResponseTime: environment === 'development' ? 1500 : 1000,
        maxResponseTime: environment === 'development' ? 4500 : 3000,
        errorRate: environment === 'development' ? 0.005 : 0.001
      },
      riskAssessment: {
        p95ResponseTime: environment === 'development' ? 3000 : 2000,
        maxResponseTime: environment === 'development' ? 7500 : 5000,
        errorRate: environment === 'development' ? 0.005 : 0.001
      },
      playbooks: {
        p95ResponseTime: environment === 'development' ? 2250 : 1500,
        maxResponseTime: environment === 'development' ? 6000 : 4000,
        errorRate: environment === 'development' ? 0.005 : 0.001
      }
    },
    ml: {
      predictionLatency: environment === 'development' ? 3000 : 2000,
      batchProcessingTime: environment === 'development' ? 45000 : 30000,
      accuracyThreshold: environment === 'development' ? 0.85 : 0.90,
      modelLoadTime: environment === 'development' ? 7500 : 5000
    }
  };

  // Apply test type specific configurations
  switch (testType) {
    case 'api':
      config.scenarios = {
        api_load_test: config.scenarios.api_load_test
      };
      config.thresholds = {
        'http_req_duration': [`p(95)<${thresholds.http.requestDuration}`],
        'http_req_failed': [`rate<${thresholds.http.failureRate}`]
      };
      break;

    case 'ml':
      config.scenarios = {
        ml_prediction_test: config.scenarios.ml_prediction_test
      };
      config.thresholds = {
        'ml_prediction_duration': [`p(99)<${thresholds.ml.predictionLatency}`],
        'http_req_failed': [`rate<${thresholds.api.riskAssessment.errorRate}`]
      };
      break;

    case 'batch':
      config.scenarios = {
        batch_processing_test: config.scenarios.batch_processing_test
      };
      config.thresholds = {
        'batch_processing_rate': [`rate>${thresholds.http.throughput}`],
        'iteration_duration': [`p(90)<${thresholds.ml.batchProcessingTime}`]
      };
      break;
  }

  return config;
}

// Export default options for k6
export const options = DEFAULT_OPTIONS;