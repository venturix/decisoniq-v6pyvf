/**
 * End-to-end tests for CRM integration functionality
 * Tests Salesforce connectivity, data synchronization, and error handling
 * @version 1.0.0
 * @package @customer-success-ai/test
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import {
  setupTestEnvironment,
  teardownTestEnvironment
} from '../../utils/test-helpers';
import {
  MockSalesforceClient,
  setupIntegrationMocks,
  teardownIntegrationMocks
} from '../../mocks/integrations';

// Constants for test configuration
const TEST_TIMEOUT = 30000;
const MOCK_ACCOUNT_ID = 'test-account-123';
const RATE_LIMIT_THRESHOLD = 1000; // Salesforce API rate limit
const BURST_LIMIT_THRESHOLD = 1500;
const PERFORMANCE_THRESHOLD_MS = 3000;

// Test environment state
let testEnv: any;
let salesforceClient: MockSalesforceClient;

describe('CRM Integration E2E Tests', () => {
  beforeAll(async () => {
    // Initialize test environment with monitoring
    testEnv = await setupTestEnvironment({
      performanceTracking: true,
      mockResponses: true
    });

    // Setup integration mocks with rate limit tracking
    await setupIntegrationMocks('development');
    salesforceClient = new MockSalesforceClient();
  }, TEST_TIMEOUT);

  afterAll(async () => {
    // Cleanup test environment and verify resources
    await teardownTestEnvironment(testEnv);
    await teardownIntegrationMocks('development');
  });

  test('should authenticate with Salesforce successfully', async () => {
    const startTime = Date.now();

    // Test authentication with valid credentials
    const authResponse = await salesforceClient.authenticate({
      credentials: {
        clientId: 'valid-client-id',
        clientSecret: 'valid-client-secret'
      }
    });

    // Verify authentication response
    expect(authResponse).toBeTruthy();
    expect(typeof authResponse).toBe('string');
    expect(authResponse.length).toBeGreaterThan(0);

    // Verify performance meets requirements
    const executionTime = Date.now() - startTime;
    expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
  });

  test('should retrieve and validate customer data', async () => {
    const startTime = Date.now();

    // Authenticate before data retrieval
    await salesforceClient.authenticate({
      credentials: {
        clientId: 'valid-client-id',
        clientSecret: 'valid-client-secret'
      }
    });

    // Retrieve customer data
    const customerData = await salesforceClient.get_customer_data(MOCK_ACCOUNT_ID);

    // Verify data structure and content
    expect(customerData).toBeDefined();
    expect(customerData).toHaveProperty('id');
    expect(customerData).toHaveProperty('name');
    expect(customerData).toHaveProperty('status');

    // Verify performance
    const executionTime = Date.now() - startTime;
    expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
  });

  test('should handle rate limits and bursts correctly', async () => {
    const requests: Promise<any>[] = [];
    let rateLimitHit = false;

    // Attempt to exceed rate limit
    for (let i = 0; i < RATE_LIMIT_THRESHOLD + 100; i++) {
      requests.push(
        salesforceClient.get_customer_data(MOCK_ACCOUNT_ID)
          .catch(error => {
            if (error.message.includes('Rate limit exceeded')) {
              rateLimitHit = true;
            }
            return null;
          })
      );
    }

    await Promise.all(requests);

    // Verify rate limiting behavior
    expect(rateLimitHit).toBeTruthy();

    // Test burst handling
    const burstRequests = await Promise.allSettled(
      Array(BURST_LIMIT_THRESHOLD - RATE_LIMIT_THRESHOLD)
        .fill(null)
        .map(() => salesforceClient.get_customer_data(MOCK_ACCOUNT_ID))
    );

    const failedBursts = burstRequests.filter(
      result => result.status === 'rejected'
    );
    expect(failedBursts.length).toBeGreaterThan(0);
  });

  test('should handle various error scenarios appropriately', async () => {
    // Test authentication failure
    await expect(
      salesforceClient.authenticate({
        credentials: {
          clientId: 'invalid-client',
          clientSecret: 'invalid-secret'
        }
      })
    ).rejects.toThrow('Authentication failed');

    // Test network timeout
    await expect(
      salesforceClient.get_customer_data('timeout-account')
    ).rejects.toThrow('Network error');

    // Test invalid account ID
    await expect(
      salesforceClient.get_customer_data('')
    ).rejects.toThrow('Invalid account ID');

    // Test unauthenticated access
    salesforceClient = new MockSalesforceClient(); // Reset client
    await expect(
      salesforceClient.get_customer_data(MOCK_ACCOUNT_ID)
    ).rejects.toThrow('Not authenticated');

    // Verify error reporting
    const errorMetrics = testEnv.mockServices.performance;
    expect(errorMetrics.errorCount).toBeGreaterThan(0);
  });

  test('should maintain data consistency during sync operations', async () => {
    // Authenticate for sync operations
    await salesforceClient.authenticate({
      credentials: {
        clientId: 'valid-client-id',
        clientSecret: 'valid-client-secret'
      }
    });

    // Perform multiple concurrent data retrievals
    const syncResults = await Promise.all([
      salesforceClient.get_customer_data(MOCK_ACCOUNT_ID),
      salesforceClient.get_customer_data(MOCK_ACCOUNT_ID),
      salesforceClient.get_customer_data(MOCK_ACCOUNT_ID)
    ]);

    // Verify data consistency
    const [result1, result2, result3] = syncResults;
    expect(result1).toEqual(result2);
    expect(result2).toEqual(result3);
    expect(result1.id).toBe(MOCK_ACCOUNT_ID);
  });
});