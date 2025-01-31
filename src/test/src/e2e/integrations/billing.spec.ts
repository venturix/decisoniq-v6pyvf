/**
 * End-to-end test suite for billing integration functionality
 * Tests Stripe payment processing, revenue tracking, and subscription management
 * @version 1.0.0
 * @package @customer-success-ai/test
 */

// External imports
import { describe, beforeAll, afterAll, it, expect } from '@jest/globals'; // v29.x
import Stripe from 'stripe'; // v5.x

// Internal imports
import { ApiClient } from '../../utils/api-client';
import { setupTestEnvironment, teardownTestEnvironment, waitForAsyncOperation } from '../../utils/test-helpers';

// Test configuration constants
const TEST_TIMEOUT = 30000;
const API_BASE_URL = process.env.API_BASE_URL;
const STRIPE_API_KEY = process.env.STRIPE_API_KEY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Initialize Stripe client
const stripe = new Stripe(STRIPE_API_KEY!, {
  apiVersion: '2023-10-16',
  typescript: true
});

// Test state management
let apiClient: ApiClient;
let testCustomerId: string;
let testSubscriptionId: string;
let initialMRR: number;

/**
 * Sets up test environment and test data for billing integration tests
 */
async function setupBillingTests(): Promise<void> {
  // Initialize test environment with performance tracking
  const env = await setupTestEnvironment({
    performanceTracking: true,
    resourceTracking: true
  });

  // Initialize API client with rate limit configuration
  apiClient = new ApiClient('development', {
    baseURL: API_BASE_URL,
    timeout: TEST_TIMEOUT,
    enableRetry: true,
    maxRetries: 3
  });

  // Create test customer with realistic profile
  const customer = await stripe.customers.create({
    email: 'test@example.com',
    name: 'Test Customer',
    metadata: {
      environment: 'test',
      testId: `test_${Date.now()}`
    }
  });

  // Create test subscription
  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{
      price: 'price_test_monthly_plan',
      quantity: 1
    }],
    metadata: {
      testId: `test_${Date.now()}`
    }
  });

  testCustomerId = customer.id;
  testSubscriptionId = subscription.id;
  initialMRR = subscription.items.data[0].price.unit_amount! / 100;
}

/**
 * Cleans up test data and environment
 */
async function cleanupBillingTests(): Promise<void> {
  // Clean up test subscription
  if (testSubscriptionId) {
    await stripe.subscriptions.del(testSubscriptionId);
  }

  // Clean up test customer
  if (testCustomerId) {
    await stripe.customers.del(testCustomerId);
  }

  // Clean up test environment
  await teardownTestEnvironment({
    fixture: {},
    mockServices: {},
    performanceMetrics: {
      setupTime: 0,
      operationTimes: [],
      memoryUsage: [],
      resourceCount: 0
    },
    cleanup: async () => {}
  });
}

describe('Billing Integration Tests', () => {
  beforeAll(async () => {
    await setupBillingTests();
  }, TEST_TIMEOUT);

  afterAll(async () => {
    await cleanupBillingTests();
  });

  it('should retrieve customer subscription details', async () => {
    const response = await apiClient.get(`/api/v1/customers/${testCustomerId}/subscription`);

    expect(response.success).toBe(true);
    expect(response.data).toMatchObject({
      customerId: testCustomerId,
      subscriptionId: testSubscriptionId,
      status: 'active',
      mrr: initialMRR,
      billingPeriod: {
        start: expect.any(String),
        end: expect.any(String)
      }
    });

    // Verify response time meets SLA
    expect(response.responseTime).toBeLessThan(3000);
  });

  it('should track revenue changes correctly', async () => {
    // Update subscription amount
    const updatedSubscription = await stripe.subscriptions.update(testSubscriptionId, {
      items: [{
        id: testSubscriptionId,
        quantity: 2
      }]
    });

    // Wait for webhook processing
    await waitForAsyncOperation(
      apiClient.get(`/api/v1/customers/${testCustomerId}/revenue-impact`),
      { timeout: 5000 }
    );

    const response = await apiClient.get(`/api/v1/customers/${testCustomerId}/subscription`);

    expect(response.success).toBe(true);
    expect(response.data).toMatchObject({
      mrr: initialMRR * 2,
      revenueChange: {
        delta: initialMRR,
        percentage: 100,
        type: 'expansion'
      }
    });

    // Verify 15% growth target tracking
    const metricsResponse = await apiClient.get('/api/v1/metrics/revenue-growth');
    expect(metricsResponse.data.expansionRevenue.percentage).toBeGreaterThanOrEqual(15);
  });

  it('should handle subscription webhooks', async () => {
    // Create mock webhook event
    const webhookEvent = {
      id: `evt_${Date.now()}`,
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: testSubscriptionId,
          customer: testCustomerId,
          status: 'active',
          items: {
            data: [{
              price: { unit_amount: initialMRR * 100 },
              quantity: 2
            }]
          }
        }
      }
    };

    // Sign webhook payload
    const signature = stripe.webhooks.generateTestHeaderString({
      payload: JSON.stringify(webhookEvent),
      secret: WEBHOOK_SECRET!
    });

    const response = await apiClient.post('/api/v1/webhooks/stripe', webhookEvent, {
      headers: {
        'Stripe-Signature': signature
      }
    });

    expect(response.success).toBe(true);
    expect(response.statusCode).toBe(200);

    // Verify webhook processing
    const eventResponse = await apiClient.get(`/api/v1/events/${webhookEvent.id}`);
    expect(eventResponse.data.status).toBe('processed');
  });

  it('should respect API rate limits', async () => {
    // Send concurrent requests to test rate limiting
    const requests = Array(10).fill(null).map(() => 
      apiClient.get(`/api/v1/customers/${testCustomerId}/subscription`)
    );

    const responses = await Promise.all(requests);
    const rateLimited = responses.some(r => r.statusCode === 429);

    expect(rateLimited).toBe(true);

    // Verify exponential backoff
    const retryResponse = await apiClient.get(
      `/api/v1/customers/${testCustomerId}/subscription`
    );

    expect(retryResponse.success).toBe(true);
    expect(retryResponse.headers['x-ratelimit-remaining']).toBeDefined();
  });
});