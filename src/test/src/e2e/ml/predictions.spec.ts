/**
 * End-to-end test suite for ML prediction endpoints
 * Validates model predictions, health scores, and performance metrics
 * @version 1.0.0
 * @package @customer-success-ai/test
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals'; // jest@29.x
import { ApiClient } from '../../utils/api-client';
import { TestFixture } from '../../types/test';
import { createTestFixture } from '../../utils/test-fixtures';
import { CustomerRiskLevel } from '../../../../web/src/types/risk';

// Test configuration constants
const TEST_TIMEOUT = 10000; // 10 seconds
const PREDICTION_LATENCY_THRESHOLD = 3000; // 3 seconds (from technical spec)
const ACCURACY_THRESHOLD = 0.9; // 90% accuracy requirement
const FALSE_POSITIVE_THRESHOLD = 0.05; // 5% max false positive rate

// Initialize API client and test fixture
let apiClient: ApiClient;
let testFixture: TestFixture;
let testCustomers: any[];
let performanceMetrics: {
  latencies: number[];
  accuracies: number[];
  predictions: number;
};

beforeAll(async () => {
  // Initialize API client with ML-specific timeout
  apiClient = new ApiClient('development', { timeout: 5000 });
  apiClient.setRequestTimeout(PREDICTION_LATENCY_THRESHOLD);

  // Create test fixture with ML test data
  testFixture = await createTestFixture('development');
  await testFixture.setup();

  // Initialize test customers with varied health profiles
  testCustomers = testFixture.data.customers.valid;

  // Initialize performance tracking
  performanceMetrics = {
    latencies: [],
    accuracies: [],
    predictions: 0
  };
});

afterAll(async () => {
  // Cleanup test data and log performance metrics
  await testFixture.teardown();

  // Log aggregated performance metrics
  console.info('ML Prediction Performance Metrics:', {
    averageLatency: calculateAverage(performanceMetrics.latencies),
    p95Latency: calculatePercentile(performanceMetrics.latencies, 95),
    averageAccuracy: calculateAverage(performanceMetrics.accuracies),
    totalPredictions: performanceMetrics.predictions
  });
});

describe('ML Predictions E2E Tests', () => {
  test('should generate accurate churn risk predictions', async () => {
    // Prepare test data with known churn patterns
    const customer = testCustomers[0];
    const startTime = Date.now();

    // Request churn prediction
    const response = await apiClient.post('/api/v1/predictions/churn', {
      customerId: customer.id,
      features: {
        usageMetrics: customer.data.metadata.usageMetrics,
        engagementMetrics: customer.data.metadata.engagementMetrics,
        supportMetrics: customer.data.metadata.supportMetrics,
        financialMetrics: customer.data.metadata.financialMetrics
      }
    });

    // Track performance metrics
    const latency = Date.now() - startTime;
    performanceMetrics.latencies.push(latency);
    performanceMetrics.predictions++;

    // Validate response structure and values
    expect(response.success).toBe(true);
    expect(response.data).toHaveProperty('riskScore');
    expect(response.data).toHaveProperty('confidence');
    expect(response.data).toHaveProperty('factors');

    // Validate score range and confidence
    expect(response.data.riskScore).toBeGreaterThanOrEqual(0);
    expect(response.data.riskScore).toBeLessThanOrEqual(100);
    expect(response.data.confidence).toBeGreaterThanOrEqual(ACCURACY_THRESHOLD);

    // Validate performance requirements
    expect(latency).toBeLessThan(PREDICTION_LATENCY_THRESHOLD);
  }, TEST_TIMEOUT);

  test('should calculate comprehensive health scores', async () => {
    // Get test customer with complete profile
    const customer = testCustomers[1];
    const startTime = Date.now();

    // Request health score calculation
    const response = await apiClient.post('/api/v1/predictions/health-score', {
      customerId: customer.id,
      metrics: {
        usage: customer.data.metadata.usageMetrics,
        engagement: customer.data.metadata.engagementMetrics,
        support: customer.data.metadata.supportMetrics,
        financial: customer.data.metadata.financialMetrics
      }
    });

    // Track performance
    const latency = Date.now() - startTime;
    performanceMetrics.latencies.push(latency);
    performanceMetrics.predictions++;

    // Validate response
    expect(response.success).toBe(true);
    expect(response.data).toHaveProperty('healthScore');
    expect(response.data).toHaveProperty('components');
    expect(response.data).toHaveProperty('trend');

    // Validate score components
    expect(response.data.components).toHaveProperty('usage');
    expect(response.data.components).toHaveProperty('engagement');
    expect(response.data.components).toHaveProperty('support');
    expect(response.data.components).toHaveProperty('financial');

    // Validate performance
    expect(latency).toBeLessThan(PREDICTION_LATENCY_THRESHOLD);
  }, TEST_TIMEOUT);

  test('should identify valid expansion opportunities', async () => {
    // Setup customer with expansion signals
    const customer = testCustomers[2];
    const startTime = Date.now();

    // Request expansion prediction
    const response = await apiClient.post('/api/v1/predictions/expansion', {
      customerId: customer.id,
      currentMrr: customer.data.mrr,
      usageMetrics: customer.data.metadata.usageMetrics,
      engagementMetrics: customer.data.metadata.engagementMetrics
    });

    // Track performance
    const latency = Date.now() - startTime;
    performanceMetrics.latencies.push(latency);
    performanceMetrics.predictions++;

    // Validate response
    expect(response.success).toBe(true);
    expect(response.data).toHaveProperty('expansionProbability');
    expect(response.data).toHaveProperty('potentialRevenue');
    expect(response.data).toHaveProperty('recommendations');

    // Validate expansion metrics
    expect(response.data.expansionProbability).toBeGreaterThanOrEqual(0);
    expect(response.data.expansionProbability).toBeLessThanOrEqual(1);
    expect(response.data.potentialRevenue).toBeGreaterThan(0);

    // Validate performance
    expect(latency).toBeLessThan(PREDICTION_LATENCY_THRESHOLD);
  }, TEST_TIMEOUT);

  test('should track model performance metrics', async () => {
    // Collect predictions for test dataset
    const predictions = await Promise.all(
      testCustomers.slice(0, 5).map(customer =>
        apiClient.post('/api/v1/predictions/churn', {
          customerId: customer.id,
          features: customer.data.metadata
        })
      )
    );

    // Calculate accuracy metrics
    const accuracies = predictions.map(p => p.data.confidence);
    performanceMetrics.accuracies.push(...accuracies);

    // Validate model performance
    const averageAccuracy = calculateAverage(accuracies);
    expect(averageAccuracy).toBeGreaterThanOrEqual(ACCURACY_THRESHOLD);

    // Validate false positive rate
    const falsePositives = predictions.filter(
      p => p.data.riskLevel === CustomerRiskLevel.HIGH && !p.data.actualChurn
    ).length;
    const falsePositiveRate = falsePositives / predictions.length;
    expect(falsePositiveRate).toBeLessThanOrEqual(FALSE_POSITIVE_THRESHOLD);
  }, TEST_TIMEOUT);

  test('should handle invalid prediction requests', async () => {
    // Test with missing required fields
    const invalidResponse1 = await apiClient.post('/api/v1/predictions/churn', {
      customerId: 'invalid-id'
    });
    expect(invalidResponse1.success).toBe(false);
    expect(invalidResponse1.error).toBeDefined();

    // Test with invalid feature values
    const invalidResponse2 = await apiClient.post('/api/v1/predictions/churn', {
      customerId: testCustomers[0].id,
      features: {
        usageMetrics: { activeUsers: -1 } // Invalid negative value
      }
    });
    expect(invalidResponse2.success).toBe(false);
    expect(invalidResponse2.error).toBeDefined();

    // Verify error handling doesn't impact performance
    const startTime = Date.now();
    const validResponse = await apiClient.post('/api/v1/predictions/churn', {
      customerId: testCustomers[0].id,
      features: testCustomers[0].data.metadata
    });
    expect(Date.now() - startTime).toBeLessThan(PREDICTION_LATENCY_THRESHOLD);
    expect(validResponse.success).toBe(true);
  }, TEST_TIMEOUT);
});

// Utility functions for metric calculations
function calculateAverage(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function calculatePercentile(values: number[], percentile: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index];
}