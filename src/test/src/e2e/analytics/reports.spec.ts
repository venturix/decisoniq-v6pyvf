/**
 * End-to-end test suite for analytics reporting functionality
 * Tests performance metrics visualization, custom report generation, and export capabilities
 * @version 1.0.0
 */

// External imports
import { test, expect } from '@jest/globals';
import { Page } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { PerformanceMonitor } from '@performance-monitor/core'; // v1.x

// Internal imports
import { setupTestEnvironment, teardownTestEnvironment } from '../../utils/test-helpers';
import ApiClient from '../../utils/api-client';
import { MetricTestFixture } from '../../types/metrics';

// Performance thresholds from technical spec
const PERFORMANCE_THRESHOLDS = {
  PAGE_LOAD: 3000, // 3s max load time
  REPORT_GENERATION: 3000, // 3s max generation time
  EXPORT_TIME: 5000 // 5s max export time
};

// Test fixtures and global variables
let apiClient: ApiClient;
let testFixture: MetricTestFixture;
let performanceMonitor: PerformanceMonitor;
let page: Page;

beforeAll(async () => {
  // Initialize test environment with analytics fixtures
  const environment = await setupTestEnvironment({
    performanceTracking: true,
    mockResponses: false
  });

  // Setup API client with performance monitoring
  apiClient = new ApiClient('development', {
    enableMetrics: true,
    enableCircuitBreaker: true
  });

  // Initialize performance monitoring
  performanceMonitor = new PerformanceMonitor({
    sampleRate: 1.0,
    enableResourceTiming: true,
    maxMeasurements: 1000
  });

  // Create test metrics data
  testFixture = await environment.fixture.createMetricTestFixture({
    name: 'analytics-reports',
    testCases: [
      {
        scenario: 'HEALTH_SCORE_CALCULATION',
        input: {
          customerId: 'test-customer-1',
          metricType: 'HEALTH_SCORE',
          value: 85,
          timestamp: new Date(),
          metadata: {}
        },
        expectedOutput: {
          customerId: 'test-customer-1',
          metricType: 'HEALTH_SCORE',
          value: 85,
          timestamp: new Date(),
          metadata: {}
        },
        description: 'Health score calculation test',
        validationRules: [],
        timeWindow: {
          startDate: new Date(),
          endDate: new Date(),
          intervalType: 'daily'
        }
      }
    ],
    benchmarks: []
  });
});

afterAll(async () => {
  // Collect performance metrics
  const metrics = performanceMonitor.getMetrics();
  
  // Validate performance meets requirements
  expect(metrics.averageResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.PAGE_LOAD);
  expect(metrics.p95ResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.PAGE_LOAD * 1.5);
  
  // Clean up test environment
  await teardownTestEnvironment({
    fixture: testFixture,
    performanceMetrics: metrics
  });
});

test('should generate custom report with selected metrics and validate performance', async () => {
  const startTime = performanceMonitor.startMeasurement('report-generation');

  // Navigate to report builder
  const navigationStart = Date.now();
  await page.goto('/analytics/reports/builder');
  expect(Date.now() - navigationStart).toBeLessThan(PERFORMANCE_THRESHOLDS.PAGE_LOAD);

  // Select report metrics
  await page.selectOption('[data-testid="metric-selector"]', [
    'retention_rate',
    'expansion_revenue',
    'intervention_success'
  ]);

  // Configure report parameters
  await page.fill('[data-testid="date-range-start"]', '2024-01-01');
  await page.fill('[data-testid="date-range-end"]', '2024-01-31');
  await page.selectOption('[data-testid="report-interval"]', 'daily');

  // Generate report
  const generateStart = Date.now();
  await page.click('[data-testid="generate-report"]');
  await page.waitForSelector('[data-testid="report-content"]');
  expect(Date.now() - generateStart).toBeLessThan(PERFORMANCE_THRESHOLDS.REPORT_GENERATION);

  // Validate report content
  const reportContent = await page.textContent('[data-testid="report-content"]');
  expect(reportContent).toContain('Retention Rate');
  expect(reportContent).toContain('Expansion Revenue');
  expect(reportContent).toContain('Intervention Success');

  // Validate visualization accessibility
  const accessibilityResults = await new AxeBuilder({ page }).analyze();
  expect(accessibilityResults.violations).toHaveLength(0);

  performanceMonitor.endMeasurement(startTime);
});

test('should export report in multiple formats with data integrity', async () => {
  const startTime = performanceMonitor.startMeasurement('report-export');

  // Generate test report
  const reportData = await apiClient.post('/api/v1/reports/generate', {
    metrics: ['retention_rate', 'expansion_revenue'],
    dateRange: {
      start: '2024-01-01',
      end: '2024-01-31'
    },
    interval: 'daily'
  });

  // Test PDF export
  const pdfExportStart = Date.now();
  const pdfResponse = await apiClient.post('/api/v1/reports/export', {
    reportId: reportData.data.id,
    format: 'pdf'
  });
  expect(Date.now() - pdfExportStart).toBeLessThan(PERFORMANCE_THRESHOLDS.EXPORT_TIME);
  expect(pdfResponse.data.url).toBeTruthy();

  // Test CSV export
  const csvExportStart = Date.now();
  const csvResponse = await apiClient.post('/api/v1/reports/export', {
    reportId: reportData.data.id,
    format: 'csv'
  });
  expect(Date.now() - csvExportStart).toBeLessThan(PERFORMANCE_THRESHOLDS.EXPORT_TIME);
  expect(csvResponse.data.url).toBeTruthy();

  // Validate exported data integrity
  const csvContent = await apiClient.downloadFile(csvResponse.data.url);
  expect(csvContent).toContain('Retention Rate');
  expect(csvContent).toContain('Expansion Revenue');

  performanceMonitor.endMeasurement(startTime);
});

test('should display performance metrics with correct visualizations and accessibility', async () => {
  const startTime = performanceMonitor.startMeasurement('metrics-visualization');

  // Navigate to metrics dashboard
  const navigationStart = Date.now();
  await page.goto('/analytics/metrics');
  expect(Date.now() - navigationStart).toBeLessThan(PERFORMANCE_THRESHOLDS.PAGE_LOAD);

  // Verify retention rate display
  const retentionChart = await page.waitForSelector('[data-testid="retention-chart"]');
  expect(await retentionChart.isVisible()).toBe(true);

  // Validate chart accessibility
  const chartAccessibility = await new AxeBuilder({ page })
    .include('[data-testid="retention-chart"]')
    .analyze();
  expect(chartAccessibility.violations).toHaveLength(0);

  // Test chart interactivity
  await page.hover('[data-testid="retention-chart"]');
  const tooltip = await page.waitForSelector('[data-testid="chart-tooltip"]');
  expect(await tooltip.isVisible()).toBe(true);

  // Verify responsive behavior
  await page.setViewportSize({ width: 768, height: 1024 });
  const mobileChart = await page.waitForSelector('[data-testid="retention-chart-mobile"]');
  expect(await mobileChart.isVisible()).toBe(true);

  // Test keyboard navigation
  await page.keyboard.press('Tab');
  const focusedElement = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
  expect(focusedElement).toBe('chart-legend-item-0');

  performanceMonitor.endMeasurement(startTime);
});