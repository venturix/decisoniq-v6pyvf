/**
 * Health check endpoint test suite for Customer Success AI Platform
 * Verifies system component health monitoring and performance metrics
 * @version 1.0.0
 * @package @customer-success-ai/test
 */

// External imports - jest@29.x
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'jest';

// Internal imports
import { ApiClient, ApiResponse } from '../utils/api-client';
import { getEnvironmentConfig } from '../config/test-environment';
import { TestEnvironment } from '../types/test';

/**
 * Interface for comprehensive health check response
 */
interface HealthResponse {
  healthy: boolean;
  database: {
    connected: boolean;
    responseTime: number;
    connectionPool: number;
    activeQueries: number;
  };
  redis: {
    connected: boolean;
    responseTime: number;
    memoryUsage: number;
    hitRate: number;
  };
  metrics: {
    uptime: number;
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    mlService: {
      available: boolean;
      predictionLatency: number;
    };
  };
}

// Test configuration constants
const TEST_TIMEOUT = 5000;
const PERFORMANCE_THRESHOLDS = {
  responseTime: 3000,  // 3s SLA requirement
  errorRate: 0.001,    // 99.9% uptime requirement
  cacheHitRate: 0.95   // 95% cache hit rate target
};

// Test suite state
let apiClient: ApiClient;

describe('Health Check API', () => {
  beforeAll(async () => {
    // Initialize test environment and API client
    const environment: TestEnvironment = process.env.TEST_ENV as TestEnvironment || 'development';
    const config = getEnvironmentConfig(environment);
    
    apiClient = new ApiClient(environment, {
      timeout: TEST_TIMEOUT,
      enableRetry: true,
      maxRetries: 3,
      enableMetrics: true
    });
  });

  afterAll(async () => {
    // Clean up test resources
    const metrics = apiClient.getMetrics();
    console.log('Test suite performance metrics:', metrics);
  });

  beforeEach(() => {
    // Reset test state before each test
    jest.setTimeout(TEST_TIMEOUT);
  });

  it('should return comprehensive system health status', async () => {
    // Make request to health endpoint
    const response: ApiResponse<HealthResponse> = await apiClient.get('/health');

    // Verify successful response
    expect(response.success).toBe(true);
    expect(response.statusCode).toBe(200);
    expect(response.responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.responseTime);

    // Validate response structure
    const health = response.data;
    expect(health).toHaveProperty('healthy');
    expect(health).toHaveProperty('database');
    expect(health).toHaveProperty('redis');
    expect(health).toHaveProperty('metrics');

    // Verify system health
    expect(health.healthy).toBe(true);
    
    // Validate database health
    expect(health.database.connected).toBe(true);
    expect(health.database.responseTime).toBeLessThan(1000);
    expect(health.database.connectionPool).toBeGreaterThan(0);
    expect(health.database.activeQueries).toBeGreaterThanOrEqual(0);

    // Validate Redis health
    expect(health.redis.connected).toBe(true);
    expect(health.redis.responseTime).toBeLessThan(500);
    expect(health.redis.memoryUsage).toBeGreaterThan(0);
    expect(health.redis.hitRate).toBeGreaterThan(PERFORMANCE_THRESHOLDS.cacheHitRate);

    // Validate ML service health
    expect(health.metrics.mlService.available).toBe(true);
    expect(health.metrics.mlService.predictionLatency).toBeLessThan(3000);
  });

  it('should report valid and comprehensive performance metrics', async () => {
    // Make request to health endpoint
    const response: ApiResponse<HealthResponse> = await apiClient.get('/health');

    // Verify successful response
    expect(response.success).toBe(true);
    expect(response.statusCode).toBe(200);

    // Validate metrics structure
    const metrics = response.data.metrics;
    expect(metrics).toBeDefined();
    
    // Verify uptime meets SLA
    expect(metrics.uptime).toBeGreaterThan(99.9);
    
    // Verify request tracking
    expect(metrics.totalRequests).toBeGreaterThan(0);
    
    // Verify response time meets SLA
    expect(metrics.averageResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.responseTime);
    
    // Verify error rate meets SLA
    expect(metrics.errorRate).toBeLessThan(PERFORMANCE_THRESHOLDS.errorRate);
    
    // Verify ML service metrics
    expect(metrics.mlService.available).toBe(true);
    expect(metrics.mlService.predictionLatency).toBeLessThan(3000);
  });

  it('should handle degraded component states appropriately', async () => {
    // Make request to health endpoint
    const response: ApiResponse<HealthResponse> = await apiClient.get('/health');

    // Verify response structure
    expect(response.success).toBe(true);
    expect(response.data).toHaveProperty('healthy');

    const health = response.data;

    // System should report unhealthy if critical components are down
    if (!health.database.connected || !health.redis.connected) {
      expect(health.healthy).toBe(false);
    }

    // Validate degraded metrics reporting
    if (health.metrics.errorRate > PERFORMANCE_THRESHOLDS.errorRate) {
      expect(health.healthy).toBe(false);
    }

    if (health.metrics.averageResponseTime > PERFORMANCE_THRESHOLDS.responseTime) {
      expect(health.healthy).toBe(false);
    }

    // ML service degradation should be reported but not fail health check
    if (!health.metrics.mlService.available) {
      expect(health.metrics.mlService.predictionLatency).toBeNull();
    }
  });
});