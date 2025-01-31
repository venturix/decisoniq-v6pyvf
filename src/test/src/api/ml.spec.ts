/**
 * Test suite for Machine Learning API endpoints of the Customer Success AI Platform
 * Validates risk assessment, prediction accuracy, and model performance metrics
 * @version 1.0.0
 */

import { describe, it, beforeAll, afterAll, expect, jest } from '@jest/globals';
import { ApiClient } from '../utils/api-client';
import { setupTestEnvironment, teardownTestEnvironment } from '../utils/test-helpers';
import { MockRiskModel } from '../mocks/ml';

// Constants for test configuration
const TEST_TIMEOUT = 10000;
const API_BASE_URL = '/api/v1/ml';
const PERFORMANCE_THRESHOLD_MS = 3000;
const ACCURACY_THRESHOLD = 0.90;
const FALSE_POSITIVE_THRESHOLD = 0.05;

// Test data fixtures
const mockCustomerData = {
  customerId: 'test-customer-1',
  features: {
    usage_metrics: {
      daily_active_users: 100,
      feature_adoption_rate: 0.75,
      session_duration: 3600
    },
    engagement_scores: {
      product_engagement: 0.85,
      support_satisfaction: 0.9,
      nps_score: 8
    },
    support_history: {
      ticket_count: 15,
      resolution_time: 24,
      escalation_rate: 0.1
    }
  }
};

// Mock prediction response
const mockPredictionResponse = {
  risk_score: 0.85,
  confidence: 0.92,
  factors: {
    usage_decline: 0.4,
    support_tickets: 0.3,
    engagement_drop: 0.2,
    contract_status: 0.1
  },
  recommendations: [
    'Increase customer engagement',
    'Address support issues',
    'Review product adoption'
  ]
};

describe('ML API Integration Tests', () => {
  let apiClient: ApiClient;
  let mockRiskModel: MockRiskModel;
  let testEnv: any;

  beforeAll(async () => {
    // Setup test environment with ML-specific configurations
    testEnv = await setupTestEnvironment();
    apiClient = new ApiClient('development', {
      baseURL: API_BASE_URL,
      timeout: TEST_TIMEOUT,
      enableMetrics: true
    });
    mockRiskModel = new MockRiskModel();
  });

  afterAll(async () => {
    await teardownTestEnvironment(testEnv);
  });

  describe('Risk Assessment Endpoints', () => {
    it('should predict customer risk with high accuracy', async () => {
      // Arrange
      const startTime = Date.now();

      // Act
      const response = await apiClient.post('/predict/risk', mockCustomerData);

      // Assert
      expect(response.success).toBe(true);
      expect(response.data.risk_score).toBeGreaterThanOrEqual(0);
      expect(response.data.risk_score).toBeLessThanOrEqual(1);
      expect(response.data.confidence).toBeGreaterThan(ACCURACY_THRESHOLD);
      expect(response.responseTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
    });

    it('should provide detailed risk factors with impact scores', async () => {
      // Act
      const response = await apiClient.get(`/risk-factors/${mockCustomerData.customerId}`);

      // Assert
      expect(response.success).toBe(true);
      expect(response.data.factors).toBeDefined();
      expect(Object.keys(response.data.factors).length).toBeGreaterThan(0);
      expect(response.data.factors).toHaveProperty('usage_decline');
      expect(response.data.factors).toHaveProperty('support_tickets');
    });

    it('should validate prediction confidence thresholds', async () => {
      // Act
      const prediction = await mockRiskModel.predictRisk(mockCustomerData);

      // Assert
      expect(prediction.confidence).toBeGreaterThan(ACCURACY_THRESHOLD);
      expect(prediction.falsePositiveRate).toBeLessThan(FALSE_POSITIVE_THRESHOLD);
    });
  });

  describe('Model Performance Metrics', () => {
    it('should track and validate model accuracy', async () => {
      // Act
      const response = await apiClient.get('/metrics/accuracy');

      // Assert
      expect(response.success).toBe(true);
      expect(response.data.accuracy).toBeGreaterThan(ACCURACY_THRESHOLD);
      expect(response.data.validation_metrics).toBeDefined();
    });

    it('should monitor prediction latency', async () => {
      // Arrange
      const requests = Array(10).fill(null).map(() => 
        apiClient.post('/predict/risk', mockCustomerData)
      );

      // Act
      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const endTime = Date.now();

      // Assert
      const avgLatency = (endTime - startTime) / requests.length;
      expect(avgLatency).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      responses.forEach(response => {
        expect(response.success).toBe(true);
        expect(response.responseTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      });
    });

    it('should track feature importance scores', async () => {
      // Act
      const response = await apiClient.get('/metrics/feature-importance');

      // Assert
      expect(response.success).toBe(true);
      expect(response.data.features).toBeDefined();
      const totalImportance = Object.values(response.data.features)
        .reduce((sum: number, value: number) => sum + value, 0);
      expect(Math.abs(totalImportance - 1)).toBeLessThan(0.001);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid customer data gracefully', async () => {
      // Act
      const response = await apiClient.post('/predict/risk', {});

      // Assert
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.statusCode).toBe(400);
    });

    it('should handle missing features appropriately', async () => {
      // Arrange
      const incompleteData = { ...mockCustomerData };
      delete incompleteData.features.usage_metrics;

      // Act
      const response = await apiClient.post('/predict/risk', incompleteData);

      // Assert
      expect(response.success).toBe(true);
      expect(response.data.confidence).toBeLessThan(mockPredictionResponse.confidence);
    });

    it('should enforce rate limits on prediction endpoints', async () => {
      // Arrange
      const requests = Array(100).fill(null).map(() => 
        apiClient.post('/predict/risk', mockCustomerData)
      );

      // Act & Assert
      try {
        await Promise.all(requests);
      } catch (error: any) {
        expect(error.response?.statusCode).toBe(429);
        expect(error.response?.headers['retry-after']).toBeDefined();
      }
    });
  });
});