/**
 * Integration test suite for Customer Success AI Platform's customer management API
 * Tests CRUD operations, health scoring, risk assessment, and performance metrics
 * @version 1.0.0
 * @package @customer-success-ai/test
 */

// External imports
import { describe, test, expect } from '@jest/globals'; // v29.x
import { performance } from 'jest-performance'; // v1.x
import { TestUtils } from '@testing-library/react'; // v13.x

// Internal imports
import { ApiClient, ApiResponse } from '../utils/api-client';
import { CustomerTestData, CustomerCreate, CustomerMock } from '../types/customer';
import { getEnvironmentConfig } from '../config/test-environment';
import { getEnvironmentThresholds } from '../config/performance-thresholds';
import { testData } from '../config/test-data';

// Performance thresholds
const PERFORMANCE_THRESHOLDS = getEnvironmentThresholds('development');
const MAX_RESPONSE_TIME = PERFORMANCE_THRESHOLDS.http.requestDuration;

// Test fixtures
let apiClient: ApiClient;
let testFixture: CustomerTestData;

/**
 * Test suite setup
 */
beforeAll(async () => {
  const config = getEnvironmentConfig('development');
  apiClient = new ApiClient('development', {
    baseURL: config.apiUrl,
    timeout: config.timeout,
    enableMetrics: true
  });

  testFixture = testData.customers;
});

/**
 * Test suite cleanup
 */
afterAll(async () => {
  const metrics = apiClient.getMetrics();
  console.log('Test Performance Metrics:', metrics);
});

describe('Customer API Integration Tests', () => {
  /**
   * Customer CRUD Operations
   */
  describe('Customer CRUD Operations', () => {
    test('should create new customer with valid data', async () => {
      const validCustomer = testFixture.valid[0];
      
      const startTime = performance.now();
      const response = await apiClient.post<ApiResponse<CustomerCreate>>('/api/v1/customers', validCustomer);
      const duration = performance.now() - startTime;

      expect(response.success).toBe(true);
      expect(response.statusCode).toBe(201);
      expect(response.data).toMatchObject(validCustomer);
      expect(duration).toBeLessThan(MAX_RESPONSE_TIME);
    });

    test('should reject invalid customer data', async () => {
      const invalidCustomer = testFixture.invalid[0];
      
      const response = await apiClient.post<ApiResponse<CustomerCreate>>('/api/v1/customers', invalidCustomer);

      expect(response.success).toBe(false);
      expect(response.statusCode).toBe(400);
      expect(response.error).toBeTruthy();
    });

    test('should retrieve customer by ID', async () => {
      const mockCustomer = testFixture.mock[0];
      
      const startTime = performance.now();
      const response = await apiClient.get<ApiResponse<CustomerMock>>(`/api/v1/customers/${mockCustomer.id}`);
      const duration = performance.now() - startTime;

      expect(response.success).toBe(true);
      expect(response.statusCode).toBe(200);
      expect(response.data.id).toBe(mockCustomer.id);
      expect(duration).toBeLessThan(MAX_RESPONSE_TIME);
    });

    test('should update existing customer', async () => {
      const mockCustomer = testFixture.mock[0];
      const updateData = {
        name: 'Updated Company Name',
        mrr: 15000
      };

      const response = await apiClient.put<ApiResponse<CustomerMock>>(
        `/api/v1/customers/${mockCustomer.id}`,
        updateData
      );

      expect(response.success).toBe(true);
      expect(response.statusCode).toBe(200);
      expect(response.data.name).toBe(updateData.name);
      expect(response.data.mrr).toBe(updateData.mrr);
    });

    test('should delete customer', async () => {
      const mockCustomer = testFixture.mock[0];
      
      const response = await apiClient.delete<ApiResponse<void>>(`/api/v1/customers/${mockCustomer.id}`);

      expect(response.success).toBe(true);
      expect(response.statusCode).toBe(204);
    });
  });

  /**
   * Health Score Calculation
   */
  describe('Customer Health Score', () => {
    test('should calculate health score accurately', async () => {
      const mockCustomer = testFixture.mock[0];
      
      const response = await apiClient.get<ApiResponse<number>>(
        `/api/v1/customers/${mockCustomer.id}/health-score`
      );

      expect(response.success).toBe(true);
      expect(response.data).toBeGreaterThanOrEqual(0);
      expect(response.data).toBeLessThanOrEqual(100);
    });

    test('should include health score components', async () => {
      const mockCustomer = testFixture.mock[0];
      
      const response = await apiClient.get<ApiResponse<any>>(
        `/api/v1/customers/${mockCustomer.id}/health-details`
      );

      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('usageScore');
      expect(response.data).toHaveProperty('engagementScore');
      expect(response.data).toHaveProperty('supportScore');
      expect(response.data).toHaveProperty('financialScore');
    });
  });

  /**
   * Risk Assessment
   */
  describe('Customer Risk Assessment', () => {
    test('should assess customer risk level', async () => {
      const mockCustomer = testFixture.mock[0];
      
      const startTime = performance.now();
      const response = await apiClient.get<ApiResponse<any>>(
        `/api/v1/customers/${mockCustomer.id}/risk-assessment`
      );
      const duration = performance.now() - startTime;

      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('riskScore');
      expect(response.data).toHaveProperty('riskLevel');
      expect(response.data).toHaveProperty('riskFactors');
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.ml.predictionLatency);
    });

    test('should identify risk factors', async () => {
      const mockCustomer = testFixture.mock[0];
      
      const response = await apiClient.get<ApiResponse<any>>(
        `/api/v1/customers/${mockCustomer.id}/risk-factors`
      );

      expect(response.success).toBe(true);
      expect(Array.isArray(response.data.factors)).toBe(true);
      response.data.factors.forEach((factor: any) => {
        expect(factor).toHaveProperty('category');
        expect(factor).toHaveProperty('impactScore');
        expect(factor).toHaveProperty('description');
      });
    });
  });

  /**
   * Performance Validation
   */
  describe('Performance Requirements', () => {
    test('should handle concurrent requests', async () => {
      const mockCustomers = testFixture.mock.slice(0, 10);
      const requests = mockCustomers.map(customer => 
        apiClient.get<ApiResponse<CustomerMock>>(`/api/v1/customers/${customer.id}`)
      );

      const startTime = performance.now();
      const responses = await Promise.all(requests);
      const duration = performance.now() - startTime;

      responses.forEach(response => {
        expect(response.success).toBe(true);
        expect(response.statusCode).toBe(200);
      });

      expect(duration).toBeLessThan(MAX_RESPONSE_TIME * 2);
    });

    test('should maintain response time under threshold', async () => {
      const mockCustomer = testFixture.mock[0];
      
      const startTime = performance.now();
      const response = await apiClient.get<ApiResponse<CustomerMock>>(
        `/api/v1/customers/${mockCustomer.id}`
      );
      const duration = performance.now() - startTime;

      expect(response.success).toBe(true);
      expect(duration).toBeLessThan(MAX_RESPONSE_TIME);
    });
  });

  /**
   * Error Handling
   */
  describe('Error Handling', () => {
    test('should handle non-existent customer', async () => {
      const response = await apiClient.get<ApiResponse<CustomerMock>>('/api/v1/customers/non-existent-id');

      expect(response.success).toBe(false);
      expect(response.statusCode).toBe(404);
      expect(response.error).toBeTruthy();
    });

    test('should handle invalid request data', async () => {
      const invalidData = { name: '' };
      
      const response = await apiClient.post<ApiResponse<CustomerCreate>>('/api/v1/customers', invalidData);

      expect(response.success).toBe(false);
      expect(response.statusCode).toBe(400);
      expect(response.error).toBeTruthy();
    });
  });
});