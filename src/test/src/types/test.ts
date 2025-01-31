/**
 * Core TypeScript type definitions and interfaces for test fixtures, mock data, and test utilities
 * @version 1.0.0
 * @package @customer-success-ai/test
 */

// External imports
import { Config } from '@jest/types'; // jest@29.x
import { DeepPartial } from 'utility-types'; // v3.10.0

// Internal imports
import { CustomerTestData } from './customer';
import { MetricTestData } from './metrics';
import { PlaybookTestData } from './playbook';

/**
 * Test environment types for environment-specific configurations
 */
export type TestEnvironment = 'development' | 'staging' | 'ci';

/**
 * Comprehensive test scenario types for different testing strategies
 */
export type TestScenario = 'unit' | 'integration' | 'e2e' | 'performance' | 'security';

/**
 * Enhanced test result type with performance metrics
 */
export type TestResult = {
  success: boolean;
  error?: string;
  data?: any;
  duration: number;
  metadata: Record<string, any>;
};

/**
 * Generic interface for test fixtures with comprehensive lifecycle management
 */
export interface TestFixture {
  /**
   * Asynchronous setup method for test fixture initialization
   */
  setup: () => Promise<void>;

  /**
   * Asynchronous teardown method for test fixture cleanup
   */
  teardown: () => Promise<void>;

  /**
   * Combined test data for all domains
   */
  data: TestData;

  /**
   * Current test environment configuration
   */
  environment: TestEnvironment;

  /**
   * Map of test-specific resources that need lifecycle management
   */
  resources: Map<string, any>;
}

/**
 * Combined interface for all test data types with strict typing
 */
export interface TestData {
  /**
   * Customer-related test data
   */
  customers: CustomerTestData;

  /**
   * Metrics-related test data
   */
  metrics: MetricTestData;

  /**
   * Playbook-related test data
   */
  playbooks: PlaybookTestData;

  /**
   * Additional metadata for test tracking
   */
  metadata: Record<string, any>;
}

/**
 * Interface for test logger with environment-specific configuration
 */
interface TestLogger {
  info: (message: string, meta?: Record<string, any>) => void;
  error: (message: string, error?: Error) => void;
  debug: (message: string, data?: any) => void;
  metrics: (name: string, value: number) => void;
}

/**
 * Enhanced interface for test execution context with resource management
 */
export interface TestContext {
  /**
   * Current test environment
   */
  environment: TestEnvironment;

  /**
   * Test fixture instance
   */
  fixture: TestFixture;

  /**
   * Asynchronous cleanup handler
   */
  cleanup: () => Promise<void>;

  /**
   * Environment-specific logger
   */
  logger: TestLogger;
}

/**
 * Optional configuration for test context setup
 */
interface TestContextOptions {
  timeout?: number;
  retries?: number;
  parallel?: boolean;
  jest?: Config.InitialOptions;
}

/**
 * Creates a test fixture with combined test data and environment configuration
 * @param scenario Test scenario to generate data for
 * @param environment Target test environment
 * @param initialData Optional initial test data
 * @returns Initialized test fixture with environment-specific configuration
 */
export async function createTestFixture(
  scenario: TestScenario,
  environment: TestEnvironment,
  initialData?: Partial<TestData>
): Promise<TestFixture> {
  const fixture: TestFixture = {
    setup: async () => {
      // Implementation will be in separate file
    },
    teardown: async () => {
      // Implementation will be in separate file
    },
    data: {
      customers: {} as CustomerTestData,
      metrics: {} as MetricTestData,
      playbooks: {} as PlaybookTestData,
      metadata: {}
    },
    environment,
    resources: new Map()
  };

  return fixture;
}

/**
 * Sets up test context with fixture, cleanup, and logging
 * @param scenario Test scenario to configure
 * @param options Optional test configuration options
 * @returns Initialized test context with complete configuration
 */
export async function setupTestContext(
  scenario: TestScenario,
  options?: Partial<TestContextOptions>
): Promise<TestContext> {
  const environment: TestEnvironment = process.env.TEST_ENV as TestEnvironment || 'development';
  const fixture = await createTestFixture(scenario, environment);

  const logger: TestLogger = {
    info: (message: string, meta?: Record<string, any>) => {
      // Implementation will be in separate file
    },
    error: (message: string, error?: Error) => {
      // Implementation will be in separate file
    },
    debug: (message: string, data?: any) => {
      // Implementation will be in separate file
    },
    metrics: (name: string, value: number) => {
      // Implementation will be in separate file
    }
  };

  return {
    environment,
    fixture,
    cleanup: async () => {
      await fixture.teardown();
    },
    logger
  };
}