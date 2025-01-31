import { Test } from '@jest/types'; // jest@29.x

/**
 * Enumeration of supported metric types for testing customer success metrics
 */
export enum MetricType {
  HEALTH_SCORE = 'HEALTH_SCORE',
  RISK_SCORE = 'RISK_SCORE',
  RETENTION_RATE = 'RETENTION_RATE',
  EXPANSION_REVENUE = 'EXPANSION_REVENUE',
  INTERVENTION_SUCCESS = 'INTERVENTION_SUCCESS'
}

/**
 * Test scenario types for different metric calculations and assessments
 */
export type MetricTestScenario = 
  | 'HEALTH_SCORE_CALCULATION'
  | 'RISK_ASSESSMENT'
  | 'CHURN_PREDICTION'
  | 'REVENUE_IMPACT'
  | 'EFFICIENCY_MEASUREMENT';

/**
 * Time window configuration for metric calculations
 */
export interface TimeWindow {
  startDate: Date;
  endDate: Date;
  intervalType: 'daily' | 'weekly' | 'monthly' | 'quarterly';
}

/**
 * Customer metric data structure
 */
export interface CustomerMetric {
  customerId: string;
  metricType: MetricType;
  value: number;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

/**
 * Validation rule for metric testing
 */
export interface MetricValidationRule {
  name: string;
  condition: (metric: CustomerMetric) => boolean;
  errorMessage: string;
  severity: 'error' | 'warning';
}

/**
 * Performance metrics for validation testing
 */
export interface MetricPerformance {
  executionTime: number;
  memoryUsage: number;
  dataPoints: number;
  accuracy: number;
}

/**
 * Metric benchmark configuration
 */
export interface MetricBenchmark {
  name: string;
  threshold: number;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  metricType: MetricType;
}

/**
 * Interface for individual metric test cases
 */
export interface MetricTestCase {
  scenario: MetricTestScenario;
  input: CustomerMetric;
  expectedOutput: CustomerMetric;
  description: string;
  validationRules: MetricValidationRule[];
  timeWindow: TimeWindow;
}

/**
 * Interface for metric test suite configuration
 */
export interface MetricTestSuite {
  name: string;
  testCases: MetricTestCase[];
  setup: () => Promise<void>;
  teardown: () => Promise<void>;
  environment: string;
  benchmarks: MetricBenchmark[];
}

/**
 * Test fixture for metric testing
 */
export interface MetricTestFixture {
  suite: MetricTestSuite;
  context: Record<string, unknown>;
  monitoring: Test.Context;
}

/**
 * Type for metric validation test results
 */
export interface MetricValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  validationTimestamp: Date;
  performanceMetrics: MetricPerformance;
}

/**
 * Creates a new metric test fixture with test data
 */
export async function createMetricTestFixture(
  config: MetricTestSuite
): Promise<MetricTestFixture> {
  const context: Record<string, unknown> = {};
  const monitoring = {} as Test.Context;

  await config.setup();

  return {
    suite: config,
    context,
    monitoring
  };
}

/**
 * Validates a metric test case configuration
 */
export function validateMetricTestCase(
  testCase: MetricTestCase
): MetricValidationResult {
  const startTime = Date.now();
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate required fields
  if (!testCase.scenario || !testCase.input || !testCase.expectedOutput) {
    errors.push('Missing required test case fields');
  }

  // Apply validation rules
  testCase.validationRules.forEach(rule => {
    const isValid = rule.condition(testCase.input);
    if (!isValid) {
      if (rule.severity === 'error') {
        errors.push(rule.errorMessage);
      } else {
        warnings.push(rule.errorMessage);
      }
    }
  });

  const endTime = Date.now();

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    validationTimestamp: new Date(),
    performanceMetrics: {
      executionTime: endTime - startTime,
      memoryUsage: process.memoryUsage().heapUsed,
      dataPoints: 1,
      accuracy: errors.length === 0 ? 1 : 0
    }
  };
}