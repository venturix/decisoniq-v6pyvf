/**
 * Core utility module providing comprehensive helper functions and utilities for testing
 * the Customer Success AI Platform.
 * @version 1.0.0
 * @package @customer-success-ai/test
 */

// External imports
import { Test } from '@jest/types'; // jest@29.x
import { expect } from '@jest/globals'; // jest@29.x
import now from 'performance-now'; // v2.1.0

// Internal imports
import { TestFixture } from '../types/test';
import { createMockServices, resetMockServices } from './mock-services';
import { TestFixtureManager } from './test-fixtures';

/**
 * Interface for test environment configuration
 */
interface TestEnvironmentConfig {
  concurrentUsers?: number;
  performanceTracking?: boolean;
  resourceTracking?: boolean;
  mockResponses?: boolean;
  timeouts?: {
    setup: number;
    teardown: number;
    operation: number;
  };
}

/**
 * Interface for test environment state and resources
 */
interface TestEnvironment {
  fixture: TestFixture;
  mockServices: ReturnType<typeof createMockServices>;
  performanceMetrics: {
    setupTime: number;
    operationTimes: number[];
    memoryUsage: number[];
    resourceCount: number;
  };
  cleanup: () => Promise<void>;
}

/**
 * Interface for async operation wait options
 */
interface WaitOptions {
  timeout?: number;
  interval?: number;
  errorOnTimeout?: boolean;
  validateResult?: (result: any) => boolean;
}

/**
 * Interface for mock API response configuration
 */
interface MockResponseConfig {
  status?: number;
  delay?: number;
  errorRate?: number;
  data?: any;
  headers?: Record<string, string>;
  validation?: (data: any) => boolean;
}

/**
 * Sets up the test environment with necessary fixtures, mocks, and monitoring
 * @param config Test environment configuration
 */
export async function setupTestEnvironment(
  config: TestEnvironmentConfig = {}
): Promise<TestEnvironment> {
  const startTime = now();

  try {
    // Initialize test fixture
    const fixtureManager = TestFixtureManager.getInstance();
    const fixture = await fixtureManager.createFixture('test', 'development');

    // Setup mock services
    const mockServices = createMockServices({
      seed: Date.now().toString(),
      delay: config.mockResponses ? 100 : 0,
      errorRate: 0.05,
      monitoring: {
        enabled: config.performanceTracking ?? true,
        sampleRate: 0.1,
        metricsRetention: 3600
      }
    });

    // Initialize performance tracking
    const performanceMetrics = {
      setupTime: 0,
      operationTimes: [],
      memoryUsage: [],
      resourceCount: 0
    };

    // Create cleanup function
    const cleanup = async () => {
      await fixtureManager.teardownFixture('test');
      await resetMockServices();
      performanceMetrics.resourceCount = 0;
    };

    // Track setup performance
    performanceMetrics.setupTime = now() - startTime;
    performanceMetrics.memoryUsage.push(process.memoryUsage().heapUsed);

    return {
      fixture,
      mockServices,
      performanceMetrics,
      cleanup
    };
  } catch (error) {
    throw new Error(`Test environment setup failed: ${(error as Error).message}`);
  }
}

/**
 * Cleans up the test environment and collects metrics
 * @param environment Test environment to teardown
 */
export async function teardownTestEnvironment(
  environment: TestEnvironment
): Promise<void> {
  const startTime = now();

  try {
    // Collect final metrics
    environment.performanceMetrics.operationTimes.push(now() - startTime);
    environment.performanceMetrics.memoryUsage.push(process.memoryUsage().heapUsed);

    // Execute cleanup
    await environment.cleanup();

    // Verify resource cleanup
    expect(environment.performanceMetrics.resourceCount).toBe(0);
  } catch (error) {
    throw new Error(`Test environment teardown failed: ${(error as Error).message}`);
  }
}

/**
 * Enhanced utility to wait for async operations with performance tracking
 * @param operation Async operation to wait for
 * @param options Wait configuration options
 */
export async function waitForAsyncOperation<T>(
  operation: Promise<T>,
  options: WaitOptions = {}
): Promise<T> {
  const startTime = now();
  const timeout = options.timeout ?? 5000;
  const interval = options.interval ?? 100;

  try {
    const result = await Promise.race([
      operation,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Operation timed out')), timeout)
      )
    ]);

    // Validate result if validator provided
    if (options.validateResult && !options.validateResult(result)) {
      throw new Error('Operation result validation failed');
    }

    // Track operation time
    const operationTime = now() - startTime;
    
    return result;
  } catch (error) {
    if (options.errorOnTimeout) {
      throw error;
    }
    return null as any;
  }
}

/**
 * Creates enhanced mock API responses with performance simulation
 * @param config Mock response configuration
 */
export function mockApiResponse(config: MockResponseConfig = {}) {
  return async () => {
    // Simulate network delay
    if (config.delay) {
      await new Promise(resolve => setTimeout(resolve, config.delay));
    }

    // Simulate error rate
    if (config.errorRate && Math.random() < config.errorRate) {
      throw new Error('Simulated API error');
    }

    // Validate response data if validator provided
    if (config.validation && !config.validation(config.data)) {
      throw new Error('Response data validation failed');
    }

    return {
      status: config.status ?? 200,
      data: config.data ?? {},
      headers: {
        'x-request-id': `test-${Date.now()}`,
        'x-response-time': `${Date.now()}`,
        ...config.headers
      }
    };
  };
}