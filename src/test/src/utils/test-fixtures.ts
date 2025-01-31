/**
 * Core utility module for managing test fixtures with enhanced performance tracking and validation
 * @version 1.0.0
 * @package @customer-success-ai/test
 */

// External imports
import { DeepPartial } from 'utility-types'; // v3.10.0
import { Test } from '@jest/types'; // v29.x

// Internal imports
import { TestFixture, TestEnvironment } from '../types/test';
import { TestDataGenerator } from './test-data-generator';
import { getEnvironmentConfig } from '../config/test-environment';

/**
 * Interface for tracking fixture performance metrics
 */
interface FixturePerformanceMetrics {
  setupTime: number;
  teardownTime: number;
  memoryUsage: number;
  resourceCount: number;
  validationTime: number;
}

/**
 * Enhanced test fixture manager with comprehensive monitoring and validation
 */
class TestFixtureManager {
  private static instance: TestFixtureManager;
  private readonly dataGenerator: TestDataGenerator;
  private readonly activeFixtures: Map<string, TestFixture>;
  private readonly performanceMetrics: Map<string, FixturePerformanceMetrics>;
  private readonly validationRules: Map<string, (data: any) => boolean>;

  private constructor() {
    this.dataGenerator = new TestDataGenerator({
      performanceTracking: true,
      piiMasking: true,
      enableCache: true
    });
    this.activeFixtures = new Map();
    this.performanceMetrics = new Map();
    this.validationRules = new Map();
    this.setupValidationRules();
    this.setupCleanupHandlers();
  }

  /**
   * Gets singleton instance of TestFixtureManager
   */
  public static getInstance(): TestFixtureManager {
    if (!TestFixtureManager.instance) {
      TestFixtureManager.instance = new TestFixtureManager();
    }
    return TestFixtureManager.instance;
  }

  /**
   * Creates a new test fixture with comprehensive validation and monitoring
   * @param fixtureId Unique identifier for the fixture
   * @param environment Test environment configuration
   */
  public async createFixture(
    fixtureId: string,
    environment: TestEnvironment
  ): Promise<TestFixture> {
    const startTime = Date.now();

    try {
      // Generate test data with validation
      const customerData = await this.dataGenerator.generateCustomerData('create');
      const metricData = await this.dataGenerator.generateMetricData('HEALTH_SCORE_CALCULATION');
      const playbookData = await this.dataGenerator.generatePlaybookData(5);

      // Create and validate fixture
      const fixture: TestFixture = {
        setup: async () => {
          const setupStart = Date.now();
          await this.validateEnvironment(environment);
          await this.setupResources(fixtureId);
          this.trackPerformance(fixtureId, 'setup', setupStart);
        },
        teardown: async () => {
          const teardownStart = Date.now();
          await this.cleanupResources(fixtureId);
          this.trackPerformance(fixtureId, 'teardown', teardownStart);
        },
        data: {
          customers: customerData,
          metrics: metricData,
          playbooks: playbookData,
          metadata: {
            environment,
            createdAt: new Date(),
            version: '1.0.0'
          }
        },
        environment,
        resources: new Map()
      };

      // Validate fixture data
      await this.validateFixture(fixture);

      // Store fixture with monitoring
      this.activeFixtures.set(fixtureId, fixture);
      this.trackPerformance(fixtureId, 'creation', startTime);

      return fixture;
    } catch (error) {
      throw new Error(`Failed to create fixture ${fixtureId}: ${(error as Error).message}`);
    }
  }

  /**
   * Retrieves an existing fixture with validation
   * @param fixtureId Unique identifier for the fixture
   */
  public getFixture(fixtureId: string): TestFixture | undefined {
    const fixture = this.activeFixtures.get(fixtureId);
    if (fixture) {
      this.validateFixtureState(fixture);
    }
    return fixture;
  }

  /**
   * Performs comprehensive fixture cleanup with resource verification
   * @param fixtureId Unique identifier for the fixture
   */
  public async teardownFixture(fixtureId: string): Promise<void> {
    const startTime = Date.now();
    const fixture = this.activeFixtures.get(fixtureId);

    if (!fixture) {
      throw new Error(`Fixture ${fixtureId} not found`);
    }

    try {
      await fixture.teardown();
      await this.verifyResourceCleanup(fixtureId);
      this.activeFixtures.delete(fixtureId);
      this.trackPerformance(fixtureId, 'teardown', startTime);
    } catch (error) {
      throw new Error(`Failed to teardown fixture ${fixtureId}: ${(error as Error).message}`);
    }
  }

  /**
   * Sets up validation rules for fixture data
   */
  private setupValidationRules(): void {
    this.validationRules.set('customerData', (data) => {
      return data && Array.isArray(data.valid) && data.valid.length > 0;
    });

    this.validationRules.set('metricData', (data) => {
      return data && Array.isArray(data.validMetrics) && data.validMetrics.length > 0;
    });

    this.validationRules.set('playbookData', (data) => {
      return data && Array.isArray(data.playbooks) && data.playbooks.length > 0;
    });
  }

  /**
   * Validates fixture environment configuration
   */
  private async validateEnvironment(environment: TestEnvironment): Promise<void> {
    const config = getEnvironmentConfig(environment);
    if (!config) {
      throw new Error(`Invalid environment configuration for ${environment}`);
    }
  }

  /**
   * Validates fixture data against defined rules
   */
  private async validateFixture(fixture: TestFixture): Promise<void> {
    const startTime = Date.now();

    for (const [rule, validator] of this.validationRules.entries()) {
      if (!validator(fixture.data[rule.replace('Data', 's')])) {
        throw new Error(`Fixture validation failed for ${rule}`);
      }
    }

    this.performanceMetrics.set(fixture.environment, {
      ...this.performanceMetrics.get(fixture.environment) || {},
      validationTime: Date.now() - startTime
    });
  }

  /**
   * Tracks performance metrics for fixture operations
   */
  private trackPerformance(fixtureId: string, operation: string, startTime: number): void {
    const metrics = this.performanceMetrics.get(fixtureId) || {
      setupTime: 0,
      teardownTime: 0,
      memoryUsage: 0,
      resourceCount: 0,
      validationTime: 0
    };

    metrics[operation === 'setup' ? 'setupTime' : 'teardownTime'] = Date.now() - startTime;
    metrics.memoryUsage = process.memoryUsage().heapUsed;
    metrics.resourceCount = this.activeFixtures.get(fixtureId)?.resources.size || 0;

    this.performanceMetrics.set(fixtureId, metrics);
  }

  /**
   * Sets up cleanup handlers for resource management
   */
  private setupCleanupHandlers(): void {
    process.on('beforeExit', async () => {
      for (const fixtureId of this.activeFixtures.keys()) {
        await this.teardownFixture(fixtureId);
      }
    });
  }

  /**
   * Validates fixture state and resources
   */
  private validateFixtureState(fixture: TestFixture): void {
    if (!fixture.data || !fixture.environment || !fixture.resources) {
      throw new Error('Invalid fixture state detected');
    }
  }

  /**
   * Sets up required resources for fixture
   */
  private async setupResources(fixtureId: string): Promise<void> {
    const fixture = this.activeFixtures.get(fixtureId);
    if (fixture) {
      // Resource setup implementation
    }
  }

  /**
   * Cleans up fixture resources
   */
  private async cleanupResources(fixtureId: string): Promise<void> {
    const fixture = this.activeFixtures.get(fixtureId);
    if (fixture) {
      // Resource cleanup implementation
    }
  }

  /**
   * Verifies complete resource cleanup
   */
  private async verifyResourceCleanup(fixtureId: string): Promise<void> {
    const fixture = this.activeFixtures.get(fixtureId);
    if (fixture && fixture.resources.size > 0) {
      throw new Error(`Resource cleanup verification failed for fixture ${fixtureId}`);
    }
  }
}

/**
 * Creates a new test fixture with enhanced validation
 * @param environment Target test environment
 */
export async function createTestFixture(environment: TestEnvironment): Promise<TestFixture> {
  const fixtureId = `fixture_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const fixtureManager = TestFixtureManager.getInstance();
  return await fixtureManager.createFixture(fixtureId, environment);
}

/**
 * Sets up test fixtures with comprehensive monitoring
 * @param environment Target test environment
 */
export async function setupTestFixtures(environment: TestEnvironment): Promise<void> {
  const fixtureManager = TestFixtureManager.getInstance();
  await fixtureManager.createFixture('global', environment);
}

// Export core functionality
export { TestFixtureManager };