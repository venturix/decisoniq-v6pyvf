/**
 * Customer test data type definitions
 * @version 1.0.0
 * @package @customer-success-ai/test
 */

import { Customer } from '../../../web/src/types/customer';
import { DeepPartial } from 'utility-types'; // v3.10.0

/**
 * Interface for test metadata tracking
 */
interface TestMetadata {
  version: string;
  coverage: number;
  generatedAt: Date;
  scenarios: string[];
}

/**
 * Interface for comprehensive customer test data sets
 */
export interface CustomerTestData {
  /**
   * Array of valid customer creation test cases
   * @minLength 1
   * @maxLength 100
   */
  valid: CustomerCreate[];

  /**
   * Array of invalid customer creation test cases
   * @minLength 1
   * @maxLength 50
   */
  invalid: CustomerCreate[];

  /**
   * Array of mock customer data for various test scenarios
   * @minLength 1
   * @maxLength 200
   */
  mock: CustomerMock[];

  /**
   * Test data metadata for tracking and versioning
   */
  metadata: TestMetadata;
}

/**
 * Interface for customer creation test data
 */
export interface CustomerCreate {
  /**
   * Customer name for testing
   * @minLength 1
   * @maxLength 255
   * @pattern ^[a-zA-Z0-9\s\-\.]+$
   */
  name: string;

  /**
   * Contract start date
   * Must be valid ISO date and not in past
   */
  contractStart: Date;

  /**
   * Contract end date
   * Must be after contractStart and within 5 years
   */
  contractEnd: Date;

  /**
   * Monthly recurring revenue
   * @minimum 0
   * @maximum 1000000
   * @precision 2
   */
  mrr: number;

  /**
   * Optional customer metadata
   * @maxSize 10KB
   */
  metadata?: { [key: string]: any };
}

/**
 * Interface for mocked customer test data
 */
export interface CustomerMock {
  /**
   * UUID v4 format customer ID
   */
  id: string;

  /**
   * Partial customer data matching Customer interface
   */
  data: DeepPartial<Customer>;

  /**
   * Customer health score for testing
   * @minimum 0
   * @maximum 100
   * @precision 1
   */
  healthScore: number;

  /**
   * Test scenario identifier
   */
  testScenario: CustomerTestScenario;

  /**
   * Expected test results
   * @minLength 1
   */
  expectedResults: CustomerTestResult[];
}

/**
 * Test scenario types for customer operations
 */
export type CustomerTestScenario = 
  | 'create'
  | 'update'
  | 'delete'
  | 'healthScore'
  | 'interaction';

/**
 * Test result type for customer operations
 */
export type CustomerTestResult = {
  success: boolean;
  data?: Customer;
  error?: string;
};

/**
 * Optional test configuration options
 */
interface TestOptions {
  seed?: number;
  locale?: string;
  customValidations?: ((data: any) => boolean)[];
}

/**
 * Creates comprehensive customer test data sets
 * @param scenario Test scenario to generate data for
 * @param options Optional test configuration
 * @returns Generated and validated test data
 */
export function createCustomerTestData(
  scenario: CustomerTestScenario,
  options?: TestOptions
): CustomerTestData {
  // Implementation will be in a separate file
  throw new Error('Not implemented');
}