/**
 * End-to-end test suite for playbook execution functionality
 * Validates execution flows, performance, and audit logging
 * @version 1.0.0
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import {
  setupTestEnvironment,
  teardownTestEnvironment,
  waitForAsyncOperation
} from '../../utils/test-helpers';
import ApiClient from '../../utils/api-client';
import { MockPlaybook, MockPlaybookExecution } from '../../types/playbook';

// Global test state
let apiClient: ApiClient;
let mockPlaybook: MockPlaybook;
let mockExecution: MockPlaybookExecution;
let performanceMetrics: {
  executionTimes: number[];
  resourceUsage: number[];
  concurrentExecutions: number;
};

// Performance thresholds from technical spec
const PERFORMANCE_THRESHOLDS = {
  maxExecutionTime: 3000, // 3s response time requirement
  maxResourceUsage: 1024 * 1024 * 100, // 100MB
  minSuccessRate: 0.99, // 99% success rate
  maxConcurrentExecutions: 200 // 200 concurrent users
};

describe('Playbook Execution E2E Tests', () => {
  beforeAll(async () => {
    // Initialize test environment with performance monitoring
    const testEnv = await setupTestEnvironment({
      performanceTracking: true,
      resourceTracking: true
    });

    // Initialize API client with metrics tracking
    apiClient = new ApiClient('development', {
      enableMetrics: true,
      enableCircuitBreaker: true
    });

    // Create mock playbook for testing
    mockPlaybook = {
      id: 'test-playbook-1',
      name: 'Test Risk Mitigation Playbook',
      description: 'Automated playbook for testing execution flows',
      steps: [
        {
          id: 'step-1',
          type: 'email',
          config: { template: 'risk-alert' },
          order: 0,
          enabled: true,
          conditions: []
        },
        {
          id: 'step-2',
          type: 'task',
          config: { assignee: 'cs-team' },
          order: 1,
          enabled: true,
          conditions: []
        }
      ],
      isTestData: true
    };

    // Initialize performance tracking
    performanceMetrics = {
      executionTimes: [],
      resourceUsage: [],
      concurrentExecutions: 0
    };
  });

  afterAll(async () => {
    // Cleanup test resources and verify
    await teardownTestEnvironment({
      verifyCleanup: true,
      generateMetrics: true
    });

    // Validate performance metrics
    const avgExecutionTime = performanceMetrics.executionTimes.reduce((a, b) => a + b, 0) / 
      performanceMetrics.executionTimes.length;
    expect(avgExecutionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.maxExecutionTime);
  });

  test('should execute playbook successfully with performance tracking', async () => {
    const startTime = Date.now();

    // Create new execution
    const executionResponse = await apiClient.post<MockPlaybookExecution>('/api/v1/playbooks/execute', {
      playbookId: mockPlaybook.id,
      customerId: 'test-customer-1'
    });

    expect(executionResponse.success).toBe(true);
    expect(executionResponse.statusCode).toBe(200);
    mockExecution = executionResponse.data;

    // Wait for execution completion with timeout
    const executionResult = await waitForAsyncOperation(
      apiClient.get<MockPlaybookExecution>(`/api/v1/playbooks/executions/${mockExecution.id}`),
      {
        timeout: PERFORMANCE_THRESHOLDS.maxExecutionTime,
        validateResult: (result) => result.data.status === 'completed'
      }
    );

    // Track performance metrics
    const executionTime = Date.now() - startTime;
    performanceMetrics.executionTimes.push(executionTime);
    performanceMetrics.resourceUsage.push(process.memoryUsage().heapUsed);

    // Validate execution results
    expect(executionResult.success).toBe(true);
    expect(executionResult.data.status).toBe('completed');
    expect(executionResult.data.error).toBeNull();
    expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.maxExecutionTime);
  });

  test('should handle concurrent playbook executions within limits', async () => {
    const concurrentExecutions = 10; // Test with 10 concurrent executions
    performanceMetrics.concurrentExecutions = concurrentExecutions;

    // Create multiple executions concurrently
    const executionPromises = Array(concurrentExecutions).fill(null).map(() => 
      apiClient.post<MockPlaybookExecution>('/api/v1/playbooks/execute', {
        playbookId: mockPlaybook.id,
        customerId: 'test-customer-1'
      })
    );

    const results = await Promise.all(executionPromises);

    // Validate all executions started successfully
    results.forEach(result => {
      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
    });

    // Wait for all executions to complete
    const completionPromises = results.map(result => 
      waitForAsyncOperation(
        apiClient.get<MockPlaybookExecution>(`/api/v1/playbooks/executions/${result.data.id}`),
        {
          timeout: PERFORMANCE_THRESHOLDS.maxExecutionTime,
          validateResult: (res) => res.data.status === 'completed'
        }
      )
    );

    const completionResults = await Promise.all(completionPromises);

    // Validate all executions completed successfully
    completionResults.forEach(result => {
      expect(result.success).toBe(true);
      expect(result.data.status).toBe('completed');
    });
  });

  test('should verify audit logging for playbook execution', async () => {
    // Get audit logs for execution
    const auditResponse = await apiClient.get(`/api/v1/playbooks/executions/${mockExecution.id}/audit`);

    expect(auditResponse.success).toBe(true);
    expect(auditResponse.data).toEqual(expect.arrayContaining([
      expect.objectContaining({
        executionId: mockExecution.id,
        event: 'execution_started',
        timestamp: expect.any(String)
      }),
      expect.objectContaining({
        executionId: mockExecution.id,
        event: 'step_completed',
        stepId: 'step-1',
        timestamp: expect.any(String)
      }),
      expect.objectContaining({
        executionId: mockExecution.id,
        event: 'execution_completed',
        timestamp: expect.any(String)
      })
    ]));
  });

  test('should validate execution performance metrics', async () => {
    // Get execution metrics
    const metricsResponse = await apiClient.get(
      `/api/v1/playbooks/executions/${mockExecution.id}/metrics`
    );

    expect(metricsResponse.success).toBe(true);
    expect(metricsResponse.data).toEqual(expect.objectContaining({
      executionTime: expect.any(Number),
      stepCount: expect.any(Number),
      resourceUsage: expect.any(Number)
    }));

    // Validate metrics against thresholds
    expect(metricsResponse.data.executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.maxExecutionTime);
    expect(metricsResponse.data.resourceUsage).toBeLessThan(PERFORMANCE_THRESHOLDS.maxResourceUsage);
  });
});