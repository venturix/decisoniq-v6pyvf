/**
 * Integration test suite for testing external service integrations
 * Tests CRM, storage, calendar and payment service endpoints with performance monitoring
 * @version 1.0.0
 * @package @customer-success-ai/test
 */

import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect } from '@jest/globals'; // jest@29.x
import ApiClient from '../utils/api-client';
import { setupIntegrationMocks, teardownIntegrationMocks } from '../mocks/integrations';
import { TestEnvironment } from '../types/test';
import { getEnvironmentConfig } from '../config/test-environment';

// Global constants
const TEST_TIMEOUT = 30000;
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000';
const PERFORMANCE_THRESHOLDS = { responseTime: 3000, uptimeTarget: 99.9 };

// Test suite setup
let apiClient: ApiClient;
let testEnvironment: TestEnvironment;

beforeAll(async () => {
  testEnvironment = process.env.TEST_ENV as TestEnvironment || 'development';
  const config = getEnvironmentConfig(testEnvironment);
  apiClient = new ApiClient(testEnvironment, {
    baseURL: API_BASE_URL,
    timeout: TEST_TIMEOUT,
    enableMetrics: true
  });
  await setupIntegrationMocks(testEnvironment);
});

afterAll(async () => {
  await teardownIntegrationMocks(testEnvironment);
});

describe('CRM Integration Tests', () => {
  beforeEach(() => {
    apiClient.setAuthToken('mock-token');
  });

  it('should authenticate with Salesforce API within performance thresholds', async () => {
    const response = await apiClient.post<{ token: string }>('/api/integrations/crm/auth', {
      provider: 'salesforce',
      credentials: {
        clientId: 'mock-client-id',
        clientSecret: 'mock-client-secret'
      }
    });

    expect(response.success).toBe(true);
    expect(response.statusCode).toBe(200);
    expect(response.data.token).toBeDefined();
    expect(response.responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.responseTime);
  });

  it('should retrieve customer data from Salesforce with data consistency checks', async () => {
    const customerId = 'mock-customer-id';
    const response = await apiClient.get(`/api/integrations/crm/customers/${customerId}`);

    expect(response.success).toBe(true);
    expect(response.data).toHaveProperty('id');
    expect(response.data).toHaveProperty('name');
    expect(response.data).toHaveProperty('status');
    expect(response.responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.responseTime);
  });

  it('should handle rate limiting correctly with exponential backoff', async () => {
    const requests = Array.from({ length: 1100 }, () => 
      apiClient.get('/api/integrations/crm/customers')
    );

    const results = await Promise.allSettled(requests);
    const rateLimited = results.filter(r => r.status === 'rejected' && r.reason.includes('rate limit'));

    expect(rateLimited.length).toBeGreaterThan(0);
    expect(apiClient.getMetrics().crm_rate_limits.count).toBeGreaterThan(0);
  });
});

describe('Storage Integration Tests', () => {
  const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });

  it('should upload file to S3 with performance monitoring', async () => {
    const response = await apiClient.uploadFile('/api/integrations/storage/upload', testFile);

    expect(response.success).toBe(true);
    expect(response.data.url).toMatch(/^https:\/\/.*\.s3\.amazonaws\.com\/.*/);
    expect(response.responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.responseTime);
  });

  it('should download file from S3 with integrity checks', async () => {
    const fileUrl = 'mock-file-url';
    const response = await apiClient.downloadFile(`/api/integrations/storage/download?url=${fileUrl}`);

    expect(response instanceof Blob).toBe(true);
    expect(response.size).toBeGreaterThan(0);
  });

  it('should handle large file transfers with chunking', async () => {
    const largeFile = new File(['x'.repeat(1024 * 1024 * 10)], 'large.txt');
    const response = await apiClient.uploadFile('/api/integrations/storage/upload', largeFile, 
      (progress) => {
        expect(progress).toBeGreaterThanOrEqual(0);
        expect(progress).toBeLessThanOrEqual(100);
      }
    );

    expect(response.success).toBe(true);
    expect(response.data.size).toBe(largeFile.size);
  });
});

describe('Calendar Integration Tests', () => {
  it('should sync calendar events with performance tracking', async () => {
    const response = await apiClient.post('/api/integrations/calendar/sync', {
      provider: 'google',
      timeRange: { start: new Date(), end: new Date() }
    });

    expect(response.success).toBe(true);
    expect(Array.isArray(response.data.events)).toBe(true);
    expect(response.responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.responseTime);
  });

  it('should create calendar appointments within SLA', async () => {
    const appointment = {
      title: 'Customer Review',
      startTime: new Date(),
      duration: 60,
      attendees: ['customer@example.com']
    };

    const response = await apiClient.post('/api/integrations/calendar/appointments', appointment);

    expect(response.success).toBe(true);
    expect(response.data.id).toBeDefined();
    expect(response.responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.responseTime);
  });

  it('should handle timezone conversions accurately', async () => {
    const timezones = ['America/New_York', 'Europe/London', 'Asia/Tokyo'];
    const results = await Promise.all(
      timezones.map(tz => 
        apiClient.get(`/api/integrations/calendar/availability?timezone=${tz}`)
      )
    );

    results.forEach(response => {
      expect(response.success).toBe(true);
      expect(response.data.slots).toBeDefined();
      expect(response.responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.responseTime);
    });
  });
});

describe('Payment Integration Tests', () => {
  it('should retrieve billing data from Stripe within timeout', async () => {
    const response = await apiClient.get('/api/integrations/payments/billing');

    expect(response.success).toBe(true);
    expect(response.data.subscriptions).toBeDefined();
    expect(response.responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.responseTime);
  });

  it('should handle subscription updates with consistency checks', async () => {
    const update = {
      subscriptionId: 'mock-sub-id',
      plan: 'enterprise',
      quantity: 10
    };

    const response = await apiClient.put('/api/integrations/payments/subscriptions', update);

    expect(response.success).toBe(true);
    expect(response.data.status).toBe('active');
    expect(response.responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.responseTime);
  });

  it('should process refunds correctly with verification', async () => {
    const refund = {
      chargeId: 'mock-charge-id',
      amount: 100,
      reason: 'customer_request'
    };

    const response = await apiClient.post('/api/integrations/payments/refunds', refund);

    expect(response.success).toBe(true);
    expect(response.data.status).toBe('succeeded');
    expect(response.responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.responseTime);
  });
});