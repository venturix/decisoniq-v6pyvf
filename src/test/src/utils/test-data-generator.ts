import { faker } from '@faker-js/faker'; // v8.x
import { DeepPartial } from 'utility-types'; // v3.10.0

// Internal type imports
import { CustomerTestData, CustomerTestScenario } from '../types/customer';
import { MetricTestData, MetricTestScenario } from '../types/metrics';
import { PlaybookTestData } from '../types/playbook';
import { RiskTestData, RiskTestScenario, RISK_TEST_RANGES } from '../types/risk';

/**
 * Configuration interface for test data generator
 */
interface TestGeneratorConfig {
  seed?: number;
  locale?: string;
  enableCache?: boolean;
  maxCacheSize?: number;
  validationRules?: Record<string, (data: any) => boolean>;
  performanceTracking?: boolean;
  piiMasking?: boolean;
}

/**
 * Performance tracking metrics interface
 */
interface PerformanceMetrics {
  generationTime: number;
  memoryUsage: number;
  cacheHits: number;
  cacheMisses: number;
}

/**
 * Core utility class for generating test data across different domains
 * with enhanced validation, performance tracking, and ML testing support
 */
export class TestDataGenerator {
  private readonly faker: typeof faker;
  private readonly config: TestGeneratorConfig;
  private readonly dataCache: Map<string, any>;
  private readonly performanceMetrics: PerformanceMetrics;

  /**
   * Initializes the test data generator with configuration
   * @param config Generator configuration options
   */
  constructor(config: TestGeneratorConfig = {}) {
    this.faker = faker;
    this.config = {
      seed: config.seed || Date.now(),
      locale: config.locale || 'en',
      enableCache: config.enableCache ?? true,
      maxCacheSize: config.maxCacheSize || 1000,
      validationRules: config.validationRules || {},
      performanceTracking: config.performanceTracking ?? true,
      piiMasking: config.piiMasking ?? true
    };

    // Initialize faker with secure seed
    this.faker.seed(this.config.seed);

    // Initialize cache and performance tracking
    this.dataCache = new Map();
    this.performanceMetrics = {
      generationTime: 0,
      memoryUsage: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  /**
   * Generates customer test data sets with enhanced validation
   * @param scenario Test scenario to generate data for
   * @returns Promise<CustomerTestData> Generated customer test data
   */
  async generateCustomerData(scenario: CustomerTestScenario): Promise<CustomerTestData> {
    const startTime = Date.now();
    const cacheKey = `customer_${scenario}`;

    // Check cache first
    if (this.config.enableCache && this.dataCache.has(cacheKey)) {
      this.performanceMetrics.cacheHits++;
      return this.dataCache.get(cacheKey);
    }

    this.performanceMetrics.cacheMisses++;

    const testData: CustomerTestData = {
      valid: Array.from({ length: 10 }, () => ({
        name: this.config.piiMasking ? 
          this.faker.company.name() : 
          `Test Company ${this.faker.number.int(1000)}`,
        contractStart: this.faker.date.future(),
        contractEnd: this.faker.date.future({ years: 2 }),
        mrr: this.faker.number.float({ min: 1000, max: 100000, precision: 2 }),
        metadata: {
          industry: this.faker.company.buzzPhrase(),
          employees: this.faker.number.int({ min: 10, max: 1000 })
        }
      })),
      invalid: [
        { name: '', contractStart: new Date(), contractEnd: new Date(), mrr: -100 },
        { name: 'A'.repeat(256), contractStart: new Date(), contractEnd: new Date(), mrr: 0 }
      ],
      mock: [],
      metadata: {
        version: '1.0.0',
        coverage: 95,
        generatedAt: new Date(),
        scenarios: [scenario]
      }
    };

    // Cache the generated data
    if (this.config.enableCache) {
      this.dataCache.set(cacheKey, testData);
      this.cleanupCache();
    }

    this.updatePerformanceMetrics(startTime);
    return testData;
  }

  /**
   * Generates metric test data sets with benchmarking support
   * @param scenario Metric test scenario
   * @returns Promise<MetricTestData> Generated metric test data
   */
  async generateMetricData(scenario: MetricTestScenario): Promise<MetricTestData> {
    const startTime = Date.now();
    const cacheKey = `metric_${scenario}`;

    if (this.config.enableCache && this.dataCache.has(cacheKey)) {
      this.performanceMetrics.cacheHits++;
      return this.dataCache.get(cacheKey);
    }

    this.performanceMetrics.cacheMisses++;

    const validMetrics = Array.from({ length: 20 }, () => ({
      customerId: this.faker.string.uuid(),
      metricType: this.faker.helpers.arrayElement(['HEALTH_SCORE', 'RISK_SCORE']),
      value: this.faker.number.float({ min: 0, max: 100, precision: 2 }),
      timestamp: this.faker.date.recent(),
      metadata: {}
    }));

    const testData = {
      validMetrics,
      invalidMetrics: [],
      benchmarks: [
        {
          name: 'Health Score Accuracy',
          threshold: 95,
          operator: 'gte',
          metricType: 'HEALTH_SCORE'
        }
      ]
    };

    if (this.config.enableCache) {
      this.dataCache.set(cacheKey, testData);
      this.cleanupCache();
    }

    this.updatePerformanceMetrics(startTime);
    return testData;
  }

  /**
   * Generates playbook test data sets with execution tracking
   * @param count Number of playbooks to generate
   * @returns Promise<PlaybookTestData> Generated playbook test data
   */
  async generatePlaybookData(count: number = 5): Promise<PlaybookTestData> {
    const startTime = Date.now();
    const cacheKey = `playbook_${count}`;

    if (this.config.enableCache && this.dataCache.has(cacheKey)) {
      this.performanceMetrics.cacheHits++;
      return this.dataCache.get(cacheKey);
    }

    this.performanceMetrics.cacheMisses++;

    const testData: PlaybookTestData = {
      playbooks: Array.from({ length: count }, () => ({
        id: this.faker.string.uuid(),
        name: `Test Playbook ${this.faker.number.int(100)}`,
        description: this.faker.lorem.sentence(),
        steps: Array.from({ length: 3 }, (_, index) => ({
          id: this.faker.string.uuid(),
          type: 'action',
          config: {},
          order: index,
          enabled: true,
          conditions: []
        })),
        isTestData: true
      })),
      executions: [],
      customers: [],
      metrics: []
    };

    if (this.config.enableCache) {
      this.dataCache.set(cacheKey, testData);
      this.cleanupCache();
    }

    this.updatePerformanceMetrics(startTime);
    return testData;
  }

  /**
   * Generates risk assessment test data sets with ML validation
   * @param scenario Risk test scenario
   * @returns Promise<RiskTestData> Generated risk test data
   */
  async generateRiskData(scenario: RiskTestScenario): Promise<RiskTestData> {
    const startTime = Date.now();
    const cacheKey = `risk_${scenario}`;

    if (this.config.enableCache && this.dataCache.has(cacheKey)) {
      this.performanceMetrics.cacheHits++;
      return this.dataCache.get(cacheKey);
    }

    this.performanceMetrics.cacheMisses++;

    const testData: RiskTestData = {
      valid: Array.from({ length: 10 }, () => ({
        customerId: this.faker.string.uuid(),
        score: this.faker.number.float({ min: 0, max: 100, precision: 1 }),
        factors: Array.from({ length: 3 }, () => ({
          category: this.faker.helpers.arrayElement(['usage', 'support', 'payment', 'engagement']),
          impactScore: this.faker.number.float({ min: 0, max: 100, precision: 1 }),
          description: this.faker.lorem.sentence(),
          metadata: {}
        })),
        predictedChurnDate: this.faker.date.future(),
        revenueImpact: this.faker.number.float({ min: 1000, max: 100000, precision: 2 }),
        confidence: this.faker.number.float({ min: 0, max: 1, precision: 3 })
      })),
      invalid: [],
      mock: [],
      metadata: {
        version: '1.0.0',
        coverage: 90,
        generatedAt: new Date(),
        scenarios: [scenario],
        modelVersion: '1.0.0',
        validationRules: []
      }
    };

    if (this.config.enableCache) {
      this.dataCache.set(cacheKey, testData);
      this.cleanupCache();
    }

    this.updatePerformanceMetrics(startTime);
    return testData;
  }

  /**
   * Updates performance tracking metrics
   * @param startTime Generation start timestamp
   */
  private updatePerformanceMetrics(startTime: number): void {
    if (this.config.performanceTracking) {
      this.performanceMetrics.generationTime = Date.now() - startTime;
      this.performanceMetrics.memoryUsage = process.memoryUsage().heapUsed;
    }
  }

  /**
   * Cleans up cache if size exceeds maximum
   */
  private cleanupCache(): void {
    if (this.dataCache.size > this.config.maxCacheSize!) {
      const keysToDelete = Array.from(this.dataCache.keys())
        .slice(0, this.dataCache.size - this.config.maxCacheSize!);
      keysToDelete.forEach(key => this.dataCache.delete(key));
    }
  }
}