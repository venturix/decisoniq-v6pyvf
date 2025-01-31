/**
 * Enhanced mock implementations of external service integrations for testing
 * Provides comprehensive simulation of CRM, storage, calendar and payment services
 * @version 1.0.0
 * @package @customer-success-ai/test
 */

import { jest } from '@jest/globals'; // jest@29.x
import { setupServer, rest } from 'msw'; // msw@2.x
import { Meter, MeterProvider } from '@opentelemetry/metrics'; // @opentelemetry/metrics@1.x

import { TestEnvironment } from '../types/test';
import { getEnvironmentConfig } from '../config/test-environment';

// Global constants for mock configuration
const MOCK_DELAY = 100; // Base delay for simulating network latency
const API_RATE_LIMITS = {
  salesforce: 1000, // Requests per hour
  stripe: 500,
  calendar: 200
} as const;

const MOCK_ERROR_RATES = {
  network: 0.01, // 1% network errors
  throttling: 0.05, // 5% rate limiting
  validation: 0.02 // 2% validation errors
} as const;

/**
 * Enhanced mock implementation of AWS S3 client with performance monitoring
 */
@jest.mock('../../integrations/aws/s3')
export class MockS3Client {
  private _storage: Map<string, Buffer>;
  private _isConnected: boolean;
  private _metrics: Meter;
  private _concurrentRequests: Map<string, number>;
  private _lastAccess: Map<string, Date>;

  constructor() {
    this._storage = new Map();
    this._isConnected = true;
    this._metrics = new MeterProvider().getMeter('mock-s3');
    this._concurrentRequests = new Map();
    this._lastAccess = new Map();
  }

  async upload_file(
    file_path: string,
    bucket_name: string,
    object_key: string,
    options?: Record<string, any>
  ): Promise<string> {
    const startTime = Date.now();

    // Validate inputs
    if (!file_path || !bucket_name || !object_key) {
      throw new Error('Missing required parameters');
    }

    // Track concurrent requests
    const currentRequests = this._concurrentRequests.get(bucket_name) || 0;
    if (currentRequests > 100) {
      throw new Error('Too many concurrent requests');
    }
    this._concurrentRequests.set(bucket_name, currentRequests + 1);

    try {
      // Simulate network latency
      await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));

      // Simulate random errors
      if (Math.random() < MOCK_ERROR_RATES.network) {
        throw new Error('Network error');
      }

      // Store mock file
      this._storage.set(`${bucket_name}/${object_key}`, Buffer.from('mock-data'));
      this._lastAccess.set(`${bucket_name}/${object_key}`, new Date());

      // Record metrics
      this._metrics.createHistogram('s3_upload_duration').record(Date.now() - startTime);
      
      return `https://${bucket_name}.s3.amazonaws.com/${object_key}`;
    } finally {
      this._concurrentRequests.set(bucket_name, currentRequests);
    }
  }

  async download_file(
    bucket_name: string,
    object_key: string,
    destination_path: string,
    options?: Record<string, any>
  ): Promise<string> {
    const startTime = Date.now();

    // Validate inputs
    if (!bucket_name || !object_key || !destination_path) {
      throw new Error('Missing required parameters');
    }

    try {
      // Simulate network latency
      await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));

      // Check rate limits
      const lastAccess = this._lastAccess.get(`${bucket_name}/${object_key}`);
      if (lastAccess && Date.now() - lastAccess.getTime() < 1000) {
        throw new Error('Rate limit exceeded');
      }

      // Simulate errors
      if (Math.random() < MOCK_ERROR_RATES.network) {
        throw new Error('Network error');
      }

      // Get mock data
      const data = this._storage.get(`${bucket_name}/${object_key}`);
      if (!data) {
        throw new Error('File not found');
      }

      // Record metrics
      this._metrics.createHistogram('s3_download_duration').record(Date.now() - startTime);

      return destination_path;
    } finally {
      this._lastAccess.set(`${bucket_name}/${object_key}`, new Date());
    }
  }
}

/**
 * Enhanced mock implementation of Salesforce CRM client with rate limiting
 */
@jest.mock('../../integrations/crm/salesforce')
export class MockSalesforceClient {
  private _accounts: Map<string, object>;
  private _requestCount: number;
  private _authenticated: boolean;
  private _metrics: Meter;
  private _rateTracker: Map<string, number>;

  constructor() {
    this._accounts = new Map();
    this._requestCount = 0;
    this._authenticated = false;
    this._metrics = new MeterProvider().getMeter('mock-salesforce');
    this._rateTracker = new Map();
  }

  async authenticate(options: Record<string, any>): Promise<string> {
    const startTime = Date.now();

    try {
      // Validate credentials
      if (!options?.credentials?.clientId || !options?.credentials?.clientSecret) {
        throw new Error('Invalid credentials');
      }

      // Check rate limits
      if (this._requestCount >= API_RATE_LIMITS.salesforce) {
        throw new Error('Rate limit exceeded');
      }

      // Simulate auth delay
      await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));

      // Simulate errors
      if (Math.random() < MOCK_ERROR_RATES.validation) {
        throw new Error('Authentication failed');
      }

      this._authenticated = true;
      this._requestCount++;

      // Record metrics
      this._metrics.createHistogram('salesforce_auth_duration').record(Date.now() - startTime);

      return 'mock-access-token';
    } catch (error) {
      this._metrics.createCounter('salesforce_auth_errors').add(1);
      throw error;
    }
  }

  async get_customer_data(account_id: string, options?: Record<string, any>): Promise<object> {
    const startTime = Date.now();

    if (!this._authenticated) {
      throw new Error('Not authenticated');
    }

    try {
      // Validate input
      if (!account_id) {
        throw new Error('Invalid account ID');
      }

      // Check rate limits
      const currentRate = this._rateTracker.get(account_id) || 0;
      if (currentRate >= 10) { // Max 10 requests per account per minute
        throw new Error('Account rate limit exceeded');
      }

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));

      // Simulate errors
      if (Math.random() < MOCK_ERROR_RATES.network) {
        throw new Error('Network error');
      }

      this._requestCount++;
      this._rateTracker.set(account_id, currentRate + 1);

      // Record metrics
      this._metrics.createHistogram('salesforce_query_duration').record(Date.now() - startTime);

      return this._accounts.get(account_id) || {
        id: account_id,
        name: 'Mock Account',
        status: 'Active'
      };
    } catch (error) {
      this._metrics.createCounter('salesforce_query_errors').add(1);
      throw error;
    }
  }
}

/**
 * Enhanced setup of all integration mocks with performance monitoring
 */
export async function setupIntegrationMocks(environment: TestEnvironment): Promise<void> {
  const config = getEnvironmentConfig(environment);
  const server = setupServer();
  const metrics = new MeterProvider().getMeter('integration-mocks');

  // Setup MSW handlers
  server.use(
    rest.get('*/api/health', (req, res, ctx) => {
      return res(ctx.status(200), ctx.json({ status: 'healthy' }));
    }),

    rest.post('*/api/customers', async (req, res, ctx) => {
      // Simulate rate limiting
      if (Math.random() < MOCK_ERROR_RATES.throttling) {
        return res(ctx.status(429));
      }
      return res(ctx.status(201), ctx.json({ id: 'mock-customer-id' }));
    })
  );

  // Start MSW server
  await server.listen();

  // Initialize metrics
  metrics.createCounter('mock_requests_total');
  metrics.createHistogram('mock_response_time');

  // Setup environment-specific configurations
  if (environment === 'development') {
    // Increase error rates and latency for testing
    Object.keys(MOCK_ERROR_RATES).forEach(key => {
      MOCK_ERROR_RATES[key as keyof typeof MOCK_ERROR_RATES] *= 2;
    });
  }
}

/**
 * Enhanced cleanup of all integration mocks with verification
 */
export async function teardownIntegrationMocks(environment: TestEnvironment): Promise<void> {
  const metrics = new MeterProvider().getMeter('integration-mocks');
  
  try {
    // Stop MSW server
    const server = setupServer();
    await server.close();

    // Clear all mock storages
    const s3Client = new MockS3Client();
    const salesforceClient = new MockSalesforceClient();

    // Reset rate limiters
    Object.keys(API_RATE_LIMITS).forEach(key => {
      API_RATE_LIMITS[key as keyof typeof API_RATE_LIMITS] = 0;
    });

    // Record final metrics
    metrics.createCounter('mock_cleanup_success').add(1);
  } catch (error) {
    metrics.createCounter('mock_cleanup_errors').add(1);
    throw error;
  }
}