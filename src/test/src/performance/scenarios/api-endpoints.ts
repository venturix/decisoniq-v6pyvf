/**
 * Performance test scenarios for Customer Success AI Platform API endpoints
 * Validates system performance requirements including response times, throughput, and ML prediction latency
 * @version 1.0.0
 * @package @customer-success-ai/test
 */

// External imports - k6 v0.45.x
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Internal imports
import { ApiClient } from '../../utils/api-client';
import { PerformanceThresholds } from '../../config/performance-thresholds';

// Performance metrics tracking
const successRate = new Rate('success_rate');
const requestDuration = new Trend('request_duration');
const mlPredictionLatency = new Trend('ml_prediction_latency');
const concurrentUsers = new Trend('concurrent_users');
const batchProcessingRate = new Rate('batch_processing_rate');

// Test configuration constants
const TEST_CONFIG = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 100 },  // Increase to 100 users
    { duration: '10m', target: 200 }, // Peak load of 200 users
    { duration: '5m', target: 100 },  // Scale down to 100
    { duration: '2m', target: 0 },    // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'], // 3s max response time
    http_req_failed: ['rate<0.001'],   // 99.9% success rate
    ml_prediction_latency: ['p(95)<2000'], // 2s ML prediction time
  },
  batchSize: 1000, // For batch processing tests
};

/**
 * Test setup function - initializes test environment and configuration
 */
export function setup() {
  const client = new ApiClient('staging');
  const thresholds = {
    http: {
      requestDuration: 3000,
      failureRate: 0.001,
      concurrentUsers: 200,
    },
    api: {
      healthScore: { p95ResponseTime: 1000, maxResponseTime: 3000 },
      riskAssessment: { p95ResponseTime: 2000, maxResponseTime: 5000 },
      playbooks: { p95ResponseTime: 1500, maxResponseTime: 4000 },
    },
    ml: {
      predictionLatency: 2000,
      batchProcessingTime: 30000,
    },
  };

  return {
    client,
    thresholds,
    baseUrl: 'https://api.staging.example.com',
  };
}

/**
 * Main test scenario function
 */
export default function() {
  const config = setup();
  const client = config.client;

  // Track concurrent users
  concurrentUsers.add(1);

  // Test health endpoint
  testHealthEndpoint(client, config.thresholds);
  sleep(1);

  // Test customer health score endpoint
  testCustomerHealthScore(client, config.thresholds);
  sleep(2);

  // Test risk assessment endpoint with ML monitoring
  testRiskAssessment(client, config.thresholds);
  sleep(2);

  // Test playbook execution endpoint
  testPlaybookExecution(client, config.thresholds);
  sleep(1);

  // Batch processing test
  testBatchProcessing(client, config.thresholds);
}

/**
 * Tests the health check endpoint with performance monitoring
 */
function testHealthEndpoint(client: ApiClient, thresholds: PerformanceThresholds) {
  const response = client.get('/health');
  
  const checkResult = check(response, {
    'health check successful': (r) => r.status === 200,
    'response time within threshold': (r) => r.timings.duration < thresholds.http.requestDuration,
  });

  successRate.add(checkResult);
  requestDuration.add(response.timings.duration);
}

/**
 * Tests the customer health score endpoint under load
 */
function testCustomerHealthScore(client: ApiClient, thresholds: PerformanceThresholds) {
  const customerId = '12345'; // Test customer ID
  const response = client.get(`/api/v1/customers/${customerId}/health-score`);

  const checkResult = check(response, {
    'health score retrieved successfully': (r) => r.status === 200,
    'response time within threshold': (r) => r.timings.duration < thresholds.api.healthScore.maxResponseTime,
    'valid score returned': (r) => r.json('score') >= 0 && r.json('score') <= 100,
  });

  successRate.add(checkResult);
  requestDuration.add(response.timings.duration);
}

/**
 * Tests the risk assessment endpoint with ML prediction monitoring
 */
function testRiskAssessment(client: ApiClient, thresholds: PerformanceThresholds) {
  const customerId = '12345'; // Test customer ID
  const startTime = new Date().getTime();
  
  const response = client.get(`/api/v1/customers/${customerId}/risk-assessment`);
  
  const predictionTime = new Date().getTime() - startTime;
  mlPredictionLatency.add(predictionTime);

  const checkResult = check(response, {
    'risk assessment successful': (r) => r.status === 200,
    'prediction time within threshold': () => predictionTime < thresholds.ml.predictionLatency,
    'valid risk score': (r) => r.json('riskScore') >= 0 && r.json('riskScore') <= 100,
  });

  successRate.add(checkResult);
  requestDuration.add(response.timings.duration);
}

/**
 * Tests playbook execution endpoint with throughput tracking
 */
function testPlaybookExecution(client: ApiClient, thresholds: PerformanceThresholds) {
  const playbookData = {
    customerId: '12345',
    playbookId: '67890',
    triggerType: 'RISK_SCORE',
  };

  const response = client.post('/api/v1/playbooks/execute', playbookData);

  const checkResult = check(response, {
    'playbook execution initiated': (r) => r.status === 202,
    'response time within threshold': (r) => r.timings.duration < thresholds.api.playbooks.maxResponseTime,
    'execution id returned': (r) => r.json('executionId') !== undefined,
  });

  successRate.add(checkResult);
  requestDuration.add(response.timings.duration);
}

/**
 * Tests batch processing capabilities
 */
function testBatchProcessing(client: ApiClient, thresholds: PerformanceThresholds) {
  const batchData = Array.from({ length: TEST_CONFIG.batchSize }, (_, i) => ({
    customerId: `customer-${i}`,
    timestamp: new Date().toISOString(),
    events: ['login', 'feature_usage', 'support_ticket'],
  }));

  const response = client.post('/api/v1/events/batch', batchData);

  const checkResult = check(response, {
    'batch processing successful': (r) => r.status === 200,
    'processing time within threshold': (r) => r.timings.duration < thresholds.ml.batchProcessingTime,
    'all events processed': (r) => r.json('processedCount') === TEST_CONFIG.batchSize,
  });

  batchProcessingRate.add(checkResult);
  requestDuration.add(response.timings.duration);
}

/**
 * Test teardown function for cleanup and reporting
 */
export function teardown(data: any) {
  console.log('Performance Test Results:');
  console.log('-------------------------');
  console.log(`Success Rate: ${successRate.value}`);
  console.log(`P95 Response Time: ${requestDuration.p(95)}`);
  console.log(`ML Prediction P95 Latency: ${mlPredictionLatency.p(95)}`);
  console.log(`Max Concurrent Users: ${concurrentUsers.max}`);
  console.log(`Batch Processing Success Rate: ${batchProcessingRate.value}`);
}