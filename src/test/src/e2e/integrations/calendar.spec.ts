/**
 * End-to-end test suite for calendar integration functionality
 * Tests Google Calendar integration for scheduling customer meetings, QBRs, and training sessions
 * @version 1.0.0
 * @package @customer-success-ai/test
 */

import { test, expect, describe, beforeAll, afterAll, beforeEach } from '@jest/globals'; // v29.x
import { Page, Browser, chromium } from '@playwright/test'; // v1.40.x
import { ApiClient } from '../../utils/api-client';
import { setupIntegrationMocks, teardownIntegrationMocks } from '../../utils/mock-services';

// Constants for test configuration
const TEST_TIMEOUT = 30000;
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000';
const RATE_LIMIT_THRESHOLD = 200;
const BURST_LIMIT = 300;

// Test fixtures
let browser: Browser;
let page: Page;
let apiClient: ApiClient;

/**
 * Sets up test environment for calendar integration testing
 */
async function setupTestEnvironment(): Promise<void> {
  // Initialize API client with rate limit configuration
  apiClient = new ApiClient('development', {
    baseURL: API_BASE_URL,
    timeout: TEST_TIMEOUT,
    enableRetry: true,
    maxRetries: 3,
    enableMetrics: true
  });

  // Setup integration mocks
  await setupIntegrationMocks();

  // Launch browser with custom viewport
  browser = await chromium.launch({
    headless: true,
    timeout: TEST_TIMEOUT
  });

  // Create new page with isolation
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true
  });
  page = await context.newPage();
}

/**
 * Cleans up test environment after calendar integration testing
 */
async function cleanupTestEnvironment(): Promise<void> {
  await browser?.close();
  await teardownIntegrationMocks();
}

describe('Calendar Integration E2E Tests', () => {
  beforeAll(async () => {
    await setupTestEnvironment();
  }, TEST_TIMEOUT);

  afterAll(async () => {
    await cleanupTestEnvironment();
  });

  beforeEach(async () => {
    await page.goto(`${API_BASE_URL}/calendar-integration`);
  });

  test('should authenticate with Google Calendar', async () => {
    // Setup OAuth mock response
    const mockAuthResponse = {
      access_token: 'mock_access_token',
      refresh_token: 'mock_refresh_token',
      expires_in: 3600,
      scope: 'https://www.googleapis.com/auth/calendar'
    };

    // Test authentication flow
    const authResponse = await apiClient.post('/api/v1/calendar/auth', {
      code: 'mock_auth_code',
      redirect_uri: `${API_BASE_URL}/calendar/callback`
    });

    expect(authResponse.success).toBe(true);
    expect(authResponse.data).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      expiresIn: expect.any(Number)
    });

    // Verify token storage
    const tokenCheck = await apiClient.get('/api/v1/calendar/auth/status');
    expect(tokenCheck.data.isAuthenticated).toBe(true);
  }, TEST_TIMEOUT);

  test('should schedule customer QBR meeting', async () => {
    // Setup test data
    const customerData = {
      id: 'test-customer-123',
      name: 'Acme Corp',
      timezone: 'America/New_York'
    };

    const qbrData = {
      title: 'Quarterly Business Review - Acme Corp',
      description: 'Q1 2024 Business Review Meeting',
      duration: 60,
      attendees: ['customer@acme.com', 'csm@company.com'],
      recurrence: 'FREQ=MONTHLY;INTERVAL=3'
    };

    // Test meeting scheduling
    const scheduleResponse = await apiClient.post('/api/v1/calendar/events', {
      customerId: customerData.id,
      eventType: 'QBR',
      eventData: qbrData
    });

    expect(scheduleResponse.success).toBe(true);
    expect(scheduleResponse.data).toMatchObject({
      eventId: expect.any(String),
      meetingLink: expect.any(String),
      attendees: expect.arrayContaining(qbrData.attendees)
    });

    // Verify calendar event creation
    const eventCheck = await apiClient.get(`/api/v1/calendar/events/${scheduleResponse.data.eventId}`);
    expect(eventCheck.data.status).toBe('confirmed');
  }, TEST_TIMEOUT);

  test('should handle rate limiting', async () => {
    // Setup rate limit test data
    const requests = Array(RATE_LIMIT_THRESHOLD + 10).fill(null).map((_, index) => ({
      customerId: `customer-${index}`,
      eventType: 'training',
      eventData: {
        title: `Training Session ${index}`,
        duration: 30
      }
    }));

    // Test rate limit handling
    const responses = await Promise.allSettled(
      requests.map(req => apiClient.post('/api/v1/calendar/events', req))
    );

    // Verify rate limit enforcement
    const successfulRequests = responses.filter(r => r.status === 'fulfilled').length;
    const rateLimitedRequests = responses.filter(
      r => r.status === 'rejected' && r.reason?.response?.status === 429
    ).length;

    expect(successfulRequests).toBeLessThanOrEqual(RATE_LIMIT_THRESHOLD);
    expect(rateLimitedRequests).toBeGreaterThan(0);

    // Test burst limit behavior
    const burstMetrics = await apiClient.getMetrics();
    expect(burstMetrics['POST_/api/v1/calendar/events'].max).toBeLessThanOrEqual(BURST_LIMIT);
  }, TEST_TIMEOUT);

  test('should sync calendar events with playbook tasks', async () => {
    // Setup test playbook with calendar tasks
    const playbookData = {
      id: 'test-playbook-123',
      name: 'Customer Onboarding',
      steps: [
        {
          type: 'calendar',
          action: 'schedule_training',
          config: {
            title: 'Product Training Session',
            duration: 60
          }
        }
      ]
    };

    // Execute playbook automation
    const executionResponse = await apiClient.post('/api/v1/playbooks/execute', {
      playbookId: playbookData.id,
      customerId: 'test-customer-123'
    });

    expect(executionResponse.success).toBe(true);
    expect(executionResponse.data.status).toBe('completed');

    // Verify calendar sync
    const syncCheck = await apiClient.get('/api/v1/calendar/sync/status');
    expect(syncCheck.data).toMatchObject({
      lastSync: expect.any(String),
      syncedEvents: expect.any(Number),
      pendingSync: 0
    });

    // Verify task status update
    const taskCheck = await apiClient.get(`/api/v1/playbooks/executions/${executionResponse.data.executionId}/tasks`);
    const calendarTask = taskCheck.data.tasks.find((t: any) => t.type === 'calendar');
    expect(calendarTask.status).toBe('completed');
    expect(calendarTask.result.eventId).toBeTruthy();
  }, TEST_TIMEOUT);
});