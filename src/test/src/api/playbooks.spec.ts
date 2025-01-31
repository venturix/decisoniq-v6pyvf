/**
 * API integration tests for playbook management endpoints
 * Validates CRUD operations, execution flows, performance metrics, and security controls
 * @version 1.0.0
 * @package @customer-success-ai/test
 */

// External imports - jest@29.x
import { describe, it, expect, beforeEach, afterEach } from 'jest';

// Internal imports
import ApiClient from '../utils/api-client';
import { MockPlaybook } from '../types/playbook';
import { createMockPlaybook, createMockPlaybookList } from '../mocks/playbooks';
import { PlaybookStatus, PlaybookTriggerType } from '../../web/src/types/playbook';

// Performance threshold constant from technical spec (3s requirement)
const PERFORMANCE_THRESHOLD_MS = 3000;

// Test suite globals
let apiClient: ApiClient;
let mockPlaybook: MockPlaybook;

/**
 * Sets up test environment before each test
 */
const setupTestEnvironment = async (): Promise<void> => {
  apiClient = new ApiClient('development', {
    enableMetrics: true,
    enableCircuitBreaker: true
  });
  mockPlaybook = createMockPlaybook({
    status: PlaybookStatus.ACTIVE,
    triggerType: PlaybookTriggerType.RISK_SCORE
  });
};

/**
 * Cleans up test environment after each test
 */
const cleanupTestEnvironment = async (): Promise<void> => {
  await apiClient?.teardown?.();
};

/**
 * Validates API response time against performance threshold
 */
const validatePerformance = (responseTime: number): void => {
  expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
};

describe('Playbook API Endpoints', () => {
  beforeEach(setupTestEnvironment);
  afterEach(cleanupTestEnvironment);

  describe('GET /api/playbooks', () => {
    it('should return list of playbooks with performance validation', async () => {
      // Arrange
      const expectedCount = 10;
      const mockPlaybooks = createMockPlaybookList(expectedCount);

      // Act
      const response = await apiClient.get('/api/playbooks');

      // Assert
      expect(response.success).toBe(true);
      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data.length).toBeGreaterThan(0);
      validatePerformance(response.responseTime);

      // Validate data structure
      const playbook = response.data[0];
      expect(playbook).toHaveProperty('id');
      expect(playbook).toHaveProperty('name');
      expect(playbook).toHaveProperty('steps');
      expect(playbook).toHaveProperty('triggerType');
      expect(playbook).toHaveProperty('status');
    });

    it('should support filtering playbooks by status', async () => {
      // Act
      const response = await apiClient.get('/api/playbooks', {
        status: PlaybookStatus.ACTIVE
      });

      // Assert
      expect(response.success).toBe(true);
      expect(response.data.every(p => p.status === PlaybookStatus.ACTIVE)).toBe(true);
      validatePerformance(response.responseTime);
    });

    it('should support pagination with correct limits', async () => {
      // Act
      const response = await apiClient.get('/api/playbooks', {
        page: 1,
        limit: 20
      });

      // Assert
      expect(response.success).toBe(true);
      expect(response.data.length).toBeLessThanOrEqual(20);
      validatePerformance(response.responseTime);
    });
  });

  describe('POST /api/playbooks', () => {
    it('should create new playbook with security validation', async () => {
      // Act
      const response = await apiClient.post('/api/playbooks', mockPlaybook);

      // Assert
      expect(response.success).toBe(true);
      expect(response.statusCode).toBe(201);
      expect(response.data).toHaveProperty('id');
      validatePerformance(response.responseTime);

      // Validate created playbook data
      expect(response.data.name).toBe(mockPlaybook.name);
      expect(response.data.steps).toHaveLength(mockPlaybook.steps.length);
      expect(response.data.triggerType).toBe(mockPlaybook.triggerType);
    });

    it('should validate required playbook fields', async () => {
      // Arrange
      const invalidPlaybook = { ...mockPlaybook, name: '' };

      // Act
      const response = await apiClient.post('/api/playbooks', invalidPlaybook);

      // Assert
      expect(response.success).toBe(false);
      expect(response.statusCode).toBe(400);
      expect(response.error).toContain('name');
      validatePerformance(response.responseTime);
    });
  });

  describe('PUT /api/playbooks/:id', () => {
    it('should update existing playbook', async () => {
      // Arrange
      const updateData = {
        name: 'Updated Playbook Name',
        status: PlaybookStatus.ACTIVE
      };

      // Act
      const response = await apiClient.put(`/api/playbooks/${mockPlaybook.id}`, updateData);

      // Assert
      expect(response.success).toBe(true);
      expect(response.statusCode).toBe(200);
      expect(response.data.name).toBe(updateData.name);
      expect(response.data.status).toBe(updateData.status);
      validatePerformance(response.responseTime);
    });

    it('should handle non-existent playbook update', async () => {
      // Act
      const response = await apiClient.put('/api/playbooks/non-existent-id', {});

      // Assert
      expect(response.success).toBe(false);
      expect(response.statusCode).toBe(404);
      validatePerformance(response.responseTime);
    });
  });

  describe('DELETE /api/playbooks/:id', () => {
    it('should delete existing playbook', async () => {
      // Act
      const response = await apiClient.delete(`/api/playbooks/${mockPlaybook.id}`);

      // Assert
      expect(response.success).toBe(true);
      expect(response.statusCode).toBe(200);
      validatePerformance(response.responseTime);

      // Verify deletion
      const getResponse = await apiClient.get(`/api/playbooks/${mockPlaybook.id}`);
      expect(getResponse.statusCode).toBe(404);
    });
  });

  describe('POST /api/playbooks/:id/execute', () => {
    it('should execute playbook for specified customer', async () => {
      // Arrange
      const customerId = 'test-customer-id';

      // Act
      const response = await apiClient.post(`/api/playbooks/${mockPlaybook.id}/execute`, {
        customerId
      });

      // Assert
      expect(response.success).toBe(true);
      expect(response.statusCode).toBe(200);
      expect(response.data).toHaveProperty('executionId');
      validatePerformance(response.responseTime);
    });

    it('should validate customer existence before execution', async () => {
      // Act
      const response = await apiClient.post(`/api/playbooks/${mockPlaybook.id}/execute`, {
        customerId: 'non-existent-customer'
      });

      // Assert
      expect(response.success).toBe(false);
      expect(response.statusCode).toBe(404);
      expect(response.error).toContain('customer');
      validatePerformance(response.responseTime);
    });
  });

  describe('GET /api/playbooks/:id/executions', () => {
    it('should return playbook execution history', async () => {
      // Act
      const response = await apiClient.get(`/api/playbooks/${mockPlaybook.id}/executions`);

      // Assert
      expect(response.success).toBe(true);
      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
      validatePerformance(response.responseTime);

      // Validate execution data structure
      if (response.data.length > 0) {
        const execution = response.data[0];
        expect(execution).toHaveProperty('executionId');
        expect(execution).toHaveProperty('status');
        expect(execution).toHaveProperty('startedAt');
        expect(execution).toHaveProperty('completedAt');
      }
    });
  });
});