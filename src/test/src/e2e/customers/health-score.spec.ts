/**
 * End-to-end test suite for customer health score functionality
 * Tests display, calculation, and interaction with health score metrics
 * @version 1.0.0
 * @package @customer-success-ai/test
 */

import { test, expect } from '@playwright/test';
import now from 'performance-now';
import { setupTestEnvironment, teardownTestEnvironment } from '../../utils/test-helpers';
import { ApiClient } from '../../utils/api-client';
import { CustomerHealthScore } from '../../../web/src/types/customer';

/**
 * Test configuration constants aligned with technical specifications
 */
const TEST_CONFIG = {
  viewportSize: { width: 1440, height: 900 },
  networkConditions: {
    latency: 20,
    downloadThroughput: 5 * 1024 * 1024, // 5 Mbps
    uploadThroughput: 1 * 1024 * 1024 // 1 Mbps
  },
  performanceThresholds: {
    loadTime: 3000, // 3s requirement from spec
    scoreCalculation: 1000,
    renderTime: 500
  },
  testCustomer: {
    id: 'test-customer-1',
    name: 'Acme Corporation',
    expectedMetrics: {
      usage: 45,
      adoption: 62,
      support: 88
    }
  }
};

/**
 * Test environment and API client setup
 */
let testEnv: any;
let apiClient: ApiClient;
let performanceMetrics: {
  loadTimes: number[];
  calculationTimes: number[];
  renderTimes: number[];
};

test.beforeAll(async () => {
  // Initialize test environment
  testEnv = await setupTestEnvironment();
  
  // Initialize API client for health score endpoints
  apiClient = new ApiClient('development', {
    enableMetrics: true,
    enableRetry: true,
    maxRetries: 3
  });

  // Initialize performance tracking
  performanceMetrics = {
    loadTimes: [],
    calculationTimes: [],
    renderTimes: []
  };
});

test.afterAll(async () => {
  // Generate performance report
  const metrics = {
    loadTime: {
      avg: average(performanceMetrics.loadTimes),
      p95: percentile(performanceMetrics.loadTimes, 95)
    },
    calculationTime: {
      avg: average(performanceMetrics.calculationTimes),
      p95: percentile(performanceMetrics.calculationTimes, 95)
    },
    renderTime: {
      avg: average(performanceMetrics.renderTimes),
      p95: percentile(performanceMetrics.renderTimes, 95)
    }
  };

  // Validate against performance requirements
  expect(metrics.loadTime.p95).toBeLessThan(TEST_CONFIG.performanceThresholds.loadTime);
  expect(metrics.calculationTime.p95).toBeLessThan(TEST_CONFIG.performanceThresholds.scoreCalculation);
  expect(metrics.renderTime.p95).toBeLessThan(TEST_CONFIG.performanceThresholds.renderTime);

  // Cleanup test environment
  await teardownTestEnvironment(testEnv);
});

/**
 * Test health score display and accuracy
 */
test('should display customer health score metrics correctly', async ({ page }) => {
  // Set viewport and network conditions
  await page.setViewportSize(TEST_CONFIG.viewportSize);
  
  // Start performance measurement
  const startTime = now();

  // Navigate to customer health score page
  await page.goto(`/customers/${TEST_CONFIG.testCustomer.id}/health-score`);
  
  // Wait for and verify core health score elements
  await expect(page.locator('[data-testid="health-score-container"]')).toBeVisible();
  
  // Verify API response matches displayed data
  const apiResponse = await apiClient.get<CustomerHealthScore>(`/api/v1/customers/${TEST_CONFIG.testCustomer.id}/health-score`);
  expect(apiResponse.success).toBeTruthy();
  
  // Verify health score value
  const displayedScore = await page.locator('[data-testid="health-score-value"]').textContent();
  expect(Number(displayedScore)).toBe(apiResponse.data.score);

  // Verify individual metrics
  await verifyMetric(page, 'usage', TEST_CONFIG.testCustomer.expectedMetrics.usage);
  await verifyMetric(page, 'adoption', TEST_CONFIG.testCustomer.expectedMetrics.adoption);
  await verifyMetric(page, 'support', TEST_CONFIG.testCustomer.expectedMetrics.support);

  // Verify metric visualizations
  await verifyMetricVisualization(page, 'usage-chart');
  await verifyMetricVisualization(page, 'adoption-chart');
  await verifyMetricVisualization(page, 'support-chart');

  // Verify last updated timestamp
  const lastUpdated = await page.locator('[data-testid="last-updated"]').textContent();
  expect(Date.parse(lastUpdated!)).toBeTruthy();

  // Verify accessibility compliance
  const accessibilityReport = await page.accessibility.snapshot();
  expect(accessibilityReport.violations).toHaveLength(0);

  // Record performance metrics
  performanceMetrics.loadTimes.push(now() - startTime);
});

/**
 * Test health score calculation performance
 */
test('should meet performance requirements for health score operations', async ({ page }) => {
  // Configure network conditions for performance testing
  await page.route('**/*', (route) => {
    route.continue({
      ...TEST_CONFIG.networkConditions
    });
  });

  // Measure initial load time
  const loadStart = now();
  await page.goto(`/customers/${TEST_CONFIG.testCustomer.id}/health-score`);
  performanceMetrics.loadTimes.push(now() - loadStart);

  // Test score refresh performance
  const refreshStart = now();
  await page.click('[data-testid="refresh-score-button"]');
  await page.waitForResponse((response) => 
    response.url().includes('/health-score') && response.status() === 200
  );
  performanceMetrics.calculationTimes.push(now() - refreshStart);

  // Verify concurrent user simulation
  const concurrentPromises = Array(5).fill(null).map(() => 
    apiClient.get<CustomerHealthScore>(`/api/v1/customers/${TEST_CONFIG.testCustomer.id}/health-score`)
  );
  const results = await Promise.all(concurrentPromises);
  results.forEach(result => {
    expect(result.success).toBeTruthy();
    expect(result.responseTime).toBeLessThan(TEST_CONFIG.performanceThresholds.scoreCalculation);
  });
});

/**
 * Helper function to verify individual metric display
 */
async function verifyMetric(page: any, metricName: string, expectedValue: number) {
  const metric = await page.locator(`[data-testid="${metricName}-metric"]`);
  await expect(metric).toBeVisible();
  
  const value = await metric.locator('.value').textContent();
  expect(Number(value.replace('%', ''))).toBe(expectedValue);
  
  const progressBar = await metric.locator('.progress-bar');
  await expect(progressBar).toHaveAttribute('aria-valuenow', String(expectedValue));
}

/**
 * Helper function to verify metric visualization
 */
async function verifyMetricVisualization(page: any, chartId: string) {
  const chart = await page.locator(`[data-testid="${chartId}"]`);
  await expect(chart).toBeVisible();
  
  // Verify chart interactivity
  await chart.hover();
  await expect(page.locator('.tooltip')).toBeVisible();
}

/**
 * Helper function to calculate average
 */
function average(numbers: number[]): number {
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

/**
 * Helper function to calculate percentile
 */
function percentile(numbers: number[], p: number): number {
  const sorted = [...numbers].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * p / 100;
  const base = Math.floor(pos);
  const rest = pos - base;
  
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  } else {
    return sorted[base];
  }
}