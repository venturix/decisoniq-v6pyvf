/**
 * End-to-end test suite for customer intervention functionality
 * Tests automated and manual intervention workflows, playbook execution,
 * and intervention effectiveness tracking with performance monitoring
 * @version 1.0.0
 */

// External imports
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

// Internal imports
import { setupTestEnvironment, teardownTestEnvironment } from '../../utils/test-helpers';
import { TestFixtureManager } from '../../utils/test-fixtures';
import { ApiClient } from '../../utils/api-client';

// Global test state
let apiClient: ApiClient;
let fixtureManager: TestFixtureManager;
let performanceMetrics: {
  setupTime: number;
  operationTimes: number[];
  memoryUsage: number[];
  resourceCount: number;
};

/**
 * Test suite setup with performance monitoring
 */
beforeAll(async () => {
  const startTime = Date.now();

  // Initialize test environment
  const environment = await setupTestEnvironment({
    performanceTracking: true,
    resourceTracking: true,
    mockResponses: false
  });

  // Initialize API client with performance tracking
  apiClient = new ApiClient('development', {
    enableMetrics: true,
    enableCircuitBreaker: true,
    maxRetries: 2
  });

  // Setup test fixtures
  fixtureManager = TestFixtureManager.getInstance();
  await fixtureManager.createFixture('intervention-test', 'development');

  // Initialize performance metrics
  performanceMetrics = {
    setupTime: Date.now() - startTime,
    operationTimes: [],
    memoryUsage: [],
    resourceCount: 0
  };
});

/**
 * Test suite cleanup
 */
afterAll(async () => {
  await teardownTestEnvironment({
    fixture: fixtureManager.getFixture('intervention-test'),
    mockServices: null,
    performanceMetrics
  });
});

describe('Customer Intervention E2E Tests', () => {
  /**
   * Tests automated intervention workflow with performance validation
   */
  test('should execute automated intervention when risk threshold exceeded', async () => {
    const startTime = Date.now();

    // Create test customer with high risk score
    const customerResponse = await apiClient.post('/api/v1/customers', {
      name: 'Test Customer',
      contractStart: new Date(),
      contractEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      mrr: 10000,
      riskScore: 85 // High risk to trigger intervention
    });

    expect(customerResponse.success).toBe(true);
    expect(customerResponse.statusCode).toBe(201);

    // Wait for automated intervention trigger
    const interventionResponse = await apiClient.get(
      `/api/v1/customers/${customerResponse.data.id}/interventions`
    );

    expect(interventionResponse.success).toBe(true);
    expect(interventionResponse.data.status).toBe('triggered');
    expect(interventionResponse.responseTime).toBeLessThan(3000); // Sub-3s requirement

    // Verify playbook execution
    const playbookResponse = await apiClient.get(
      `/api/v1/interventions/${interventionResponse.data.id}/playbook`
    );

    expect(playbookResponse.success).toBe(true);
    expect(playbookResponse.data.steps.length).toBeGreaterThan(0);
    expect(playbookResponse.data.status).toBe('running');

    // Track performance metrics
    performanceMetrics.operationTimes.push(Date.now() - startTime);
    performanceMetrics.memoryUsage.push(process.memoryUsage().heapUsed);
  });

  /**
   * Tests manual intervention workflow with SLA compliance
   */
  test('should successfully execute manual intervention', async () => {
    const startTime = Date.now();

    // Create test customer
    const customerResponse = await apiClient.post('/api/v1/customers', {
      name: 'Manual Intervention Test',
      contractStart: new Date(),
      contractEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      mrr: 15000
    });

    expect(customerResponse.success).toBe(true);

    // Create manual intervention
    const interventionResponse = await apiClient.post(
      `/api/v1/customers/${customerResponse.data.id}/interventions`,
      {
        type: 'manual',
        reason: 'Proactive engagement',
        priority: 'high'
      }
    );

    expect(interventionResponse.success).toBe(true);
    expect(interventionResponse.responseTime).toBeLessThan(3000);

    // Execute intervention steps
    const stepResponse = await apiClient.post(
      `/api/v1/interventions/${interventionResponse.data.id}/steps`,
      {
        action: 'schedule_meeting',
        params: {
          title: 'Strategic Review',
          duration: 60
        }
      }
    );

    expect(stepResponse.success).toBe(true);
    expect(stepResponse.data.status).toBe('scheduled');

    // Track performance metrics
    performanceMetrics.operationTimes.push(Date.now() - startTime);
  });

  /**
   * Tests intervention effectiveness with detailed analytics
   */
  test('should track and validate intervention effectiveness', async () => {
    const startTime = Date.now();

    // Get test customer with completed intervention
    const customerResponse = await apiClient.post('/api/v1/customers', {
      name: 'Effectiveness Test',
      contractStart: new Date(),
      contractEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      mrr: 20000,
      riskScore: 75
    });

    // Execute intervention
    const interventionResponse = await apiClient.post(
      `/api/v1/customers/${customerResponse.data.id}/interventions`,
      {
        type: 'automated',
        playbook: 'risk_mitigation'
      }
    );

    // Wait for intervention completion
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Get effectiveness metrics
    const metricsResponse = await apiClient.get(
      `/api/v1/interventions/${interventionResponse.data.id}/metrics`
    );

    expect(metricsResponse.success).toBe(true);
    expect(metricsResponse.data).toMatchObject({
      riskScoreImprovement: expect.any(Number),
      timeToResolution: expect.any(Number),
      customerSatisfaction: expect.any(Number)
    });

    // Verify operational efficiency
    expect(metricsResponse.data.automationRate).toBeGreaterThan(0.4); // 40% reduction target
    expect(metricsResponse.responseTime).toBeLessThan(3000);

    // Track performance metrics
    performanceMetrics.operationTimes.push(Date.now() - startTime);
  });

  /**
   * Tests intervention performance monitoring and SLA compliance
   */
  test('should maintain performance SLAs during intervention execution', async () => {
    // Analyze collected metrics
    const metrics = apiClient.getMetrics();

    // Verify response times
    expect(metrics.GET_intervention.p95).toBeLessThan(3000); // Sub-3s requirement
    expect(metrics.POST_intervention.p95).toBeLessThan(3000);

    // Verify resource usage
    const avgMemoryUsage = performanceMetrics.memoryUsage.reduce((a, b) => a + b, 0) / 
      performanceMetrics.memoryUsage.length;
    expect(avgMemoryUsage).toBeLessThan(1024 * 1024 * 512); // 512MB limit

    // Verify operation efficiency
    const avgOperationTime = performanceMetrics.operationTimes.reduce((a, b) => a + b, 0) / 
      performanceMetrics.operationTimes.length;
    expect(avgOperationTime).toBeLessThan(5000); // 5s average target
  });
});