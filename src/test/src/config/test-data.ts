/**
 * @fileoverview Test data configuration for Customer Success AI Platform
 * Provides comprehensive test data sets and fixtures for all platform features
 * @version 1.0.0
 */

// External imports
import { DeepPartial } from 'utility-types'; // v3.10.0
import { faker } from '@faker-js/faker'; // v8.0.0

// Internal imports
import { CustomerTestData, CustomerCreate, CustomerMock, CustomerTestScenario } from '../types/customer';
import { RiskTestData, RiskAssessmentCreate, RiskAssessmentMock, RiskTestScenario, RISK_TEST_RANGES } from '../types/risk';
import { PlaybookTestData, MockPlaybook, MockPlaybookExecution, PlaybookTestResult } from '../types/playbook';
import { MetricTestData, MetricType, CustomerMetric, MetricBenchmark, MetricPerformance } from '../types/metrics';

/**
 * Global test configuration constants
 */
const TEST_DATA_CONFIG = {
  customerCount: 100,
  riskScoreRange: { min: 0, max: 100 },
  playbookStepTypes: ['email', 'task', 'notification', 'integration', 'webhook', 'automation'],
  metricTypes: ['health', 'risk', 'revenue', 'usage', 'engagement', 'satisfaction'],
  performanceThresholds: {
    responseTime: 3000, // milliseconds
    uptime: 99.9, // percentage
    concurrentUsers: 200
  },
  testCoverage: {
    minCoverage: 85,
    criticalPaths: true,
    edgeCases: true
  }
} as const;

/**
 * Customer test data configuration
 */
const customerTestData: CustomerTestData = {
  valid: [
    {
      name: 'Acme Corporation',
      contractStart: new Date('2024-01-01'),
      contractEnd: new Date('2025-01-01'),
      mrr: 10000,
      metadata: {
        industry: 'Technology',
        size: 'Enterprise',
        region: 'North America'
      }
    },
    // Additional valid test cases...
  ],
  invalid: [
    {
      name: '', // Invalid: Empty name
      contractStart: new Date('2023-01-01'),
      contractEnd: new Date('2022-01-01'), // Invalid: End before start
      mrr: -1000, // Invalid: Negative MRR
      metadata: null
    },
    // Additional invalid test cases...
  ],
  mock: Array.from({ length: 10 }, (_, i) => ({
    id: faker.string.uuid(),
    data: {
      name: faker.company.name(),
      contractStart: faker.date.future(),
      mrr: faker.number.int({ min: 1000, max: 100000 })
    },
    healthScore: faker.number.int({ min: 0, max: 100 }),
    testScenario: 'create' as CustomerTestScenario,
    expectedResults: []
  })),
  metadata: {
    version: '1.0.0',
    coverage: 95,
    generatedAt: new Date(),
    scenarios: ['create', 'update', 'delete', 'healthScore']
  }
};

/**
 * Risk assessment test data configuration
 */
const riskTestData: RiskTestData = {
  valid: Array.from({ length: 10 }, () => ({
    customerId: faker.string.uuid(),
    score: faker.number.int({ min: 0, max: 100 }),
    factors: Array.from({ length: 3 }, () => ({
      category: faker.helpers.arrayElement(['usage', 'support', 'payment', 'engagement']),
      impactScore: faker.number.int({ min: 0, max: 100 }),
      description: faker.lorem.sentence(),
      metadata: {}
    })),
    predictedChurnDate: faker.date.future(),
    revenueImpact: faker.number.float({ min: 0, max: 1000000, precision: 2 }),
    confidence: faker.number.float({ min: 0, max: 1, precision: 3 })
  })),
  mock: [],
  factors: [],
  benchmarks: [],
  metadata: {
    version: '1.0.0',
    coverage: 90,
    generatedAt: new Date(),
    scenarios: ['create', 'update', 'score', 'factors'],
    modelVersion: '1.0.0',
    validationRules: ['score_range', 'factor_impact', 'confidence_threshold']
  }
};

/**
 * Playbook test data configuration
 */
const playbookTestData: PlaybookTestData = {
  playbooks: Array.from({ length: 5 }, () => ({
    id: faker.string.uuid(),
    name: faker.helpers.arrayElement(['Onboarding', 'Risk Mitigation', 'Expansion', 'Renewal']),
    description: faker.lorem.paragraph(),
    steps: Array.from({ length: 3 }, (_, i) => ({
      id: faker.string.uuid(),
      type: faker.helpers.arrayElement(TEST_DATA_CONFIG.playbookStepTypes),
      config: {},
      order: i,
      enabled: true,
      conditions: []
    })),
    isTestData: true
  })),
  executions: Array.from({ length: 10 }, () => ({
    id: faker.string.uuid(),
    playbookId: faker.string.uuid(),
    customerId: faker.string.uuid(),
    status: faker.helpers.arrayElement(['pending', 'running', 'completed', 'failed']),
    startedAt: faker.date.recent(),
    completedAt: faker.date.future(),
    currentStep: faker.number.int({ min: 0, max: 5 }),
    results: {},
    error: null,
    metrics: {
      duration: faker.number.int({ min: 100, max: 5000 }),
      stepCount: faker.number.int({ min: 1, max: 10 })
    }
  })),
  customers: [],
  metrics: []
};

/**
 * Metrics test data configuration
 */
const metricsTestData: MetricTestData = {
  validMetrics: Array.from({ length: 20 }, () => ({
    customerId: faker.string.uuid(),
    metricType: faker.helpers.arrayElement(Object.values(MetricType)),
    value: faker.number.float({ min: 0, max: 100, precision: 2 }),
    timestamp: faker.date.recent(),
    metadata: {}
  })),
  invalidMetrics: [],
  benchmarks: Array.from({ length: 5 }, () => ({
    name: faker.helpers.arrayElement(['response_time', 'accuracy', 'throughput']),
    threshold: faker.number.float({ min: 0, max: 100 }),
    operator: faker.helpers.arrayElement(['gt', 'lt', 'eq']),
    metricType: faker.helpers.arrayElement(Object.values(MetricType))
  })),
  performance: Array.from({ length: 10 }, () => ({
    executionTime: faker.number.int({ min: 100, max: 1000 }),
    memoryUsage: faker.number.int({ min: 1024, max: 8192 }),
    dataPoints: faker.number.int({ min: 100, max: 1000 }),
    accuracy: faker.number.float({ min: 0.8, max: 1, precision: 3 })
  }))
};

/**
 * Combined test data export with comprehensive coverage
 */
export const testData = {
  customers: customerTestData,
  risks: riskTestData,
  playbooks: playbookTestData,
  metrics: metricsTestData,
  performance: {
    thresholds: TEST_DATA_CONFIG.performanceThresholds,
    coverage: TEST_DATA_CONFIG.testCoverage
  }
} as const;