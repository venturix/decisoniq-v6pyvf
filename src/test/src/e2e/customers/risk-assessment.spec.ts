import { test, expect } from '@playwright/test';
import { setupTestEnvironment, teardownTestEnvironment } from '../../utils/test-helpers';
import { ApiClient } from '../../utils/api-client';
import { generateTestData } from '../../utils/test-data-generator';
import type { RiskScore, RiskLevel, RiskFactor } from '../../../../web/src/types/risk';
import type { Customer } from '../../../../web/src/types/customer';

// Constants for test configuration
const TEST_TIMEOUT = 30000;
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const PERFORMANCE_THRESHOLD = 3000; // 3s requirement from spec

// Test data interfaces
interface TestCustomer extends Customer {
  expectedRiskScore: number;
  expectedRiskLevel: RiskLevel;
  expectedFactors: RiskFactor[];
}

let apiClient: ApiClient;
let testData: {
  customers: TestCustomer[];
  riskProfiles: RiskScore[];
};

test.beforeAll(async () => {
  // Initialize test environment and data
  const env = await setupTestEnvironment({
    performanceTracking: true,
    mockResponses: false
  });

  // Setup API client with authentication
  apiClient = new ApiClient('development', {
    baseURL: BASE_URL,
    timeout: TEST_TIMEOUT,
    enableMetrics: true
  });

  // Generate test data with various risk scenarios
  testData = await generateTestData({
    customerCount: 5,
    riskScenarios: ['low', 'medium', 'high', 'critical'],
    includeEdgeCases: true
  });
});

test.afterAll(async () => {
  await teardownTestEnvironment();
});

test('should display customer risk score and indicators correctly', async ({ page }) => {
  // Test customer with known risk profile
  const testCustomer = testData.customers[0];
  
  await test.step('Load risk assessment page', async () => {
    await page.goto(`${BASE_URL}/customers/${testCustomer.id}/risk`);
    await page.waitForLoadState('networkidle');
  });

  await test.step('Verify risk score display', async () => {
    const scoreElement = page.locator('[data-testid="risk-score"]');
    await expect(scoreElement).toBeVisible();
    
    const displayedScore = await scoreElement.textContent();
    expect(parseFloat(displayedScore || '0')).toBe(testCustomer.expectedRiskScore);
  });

  await test.step('Validate risk indicators', async () => {
    // Check risk level indicator
    const levelIndicator = page.locator('[data-testid="risk-level"]');
    await expect(levelIndicator).toHaveText(testCustomer.expectedRiskLevel);

    // Verify risk factors are displayed
    const factorsList = page.locator('[data-testid="risk-factors"] li');
    const factors = await factorsList.all();
    expect(factors.length).toBe(testCustomer.expectedFactors.length);

    // Verify each factor's details
    for (let i = 0; i < factors.length; i++) {
      const factor = testCustomer.expectedFactors[i];
      await expect(factors[i]).toContainText(factor.category);
      await expect(factors[i]).toContainText(factor.description);
    }
  });

  await test.step('Verify performance requirements', async () => {
    const metrics = apiClient.getMetrics();
    expect(metrics.riskAssessment.p95).toBeLessThan(PERFORMANCE_THRESHOLD);
  });
});

test('should update risk factors in real-time', async ({ page }) => {
  const testCustomer = testData.customers[1];
  
  await test.step('Initial load', async () => {
    await page.goto(`${BASE_URL}/customers/${testCustomer.id}/risk`);
    await page.waitForLoadState('networkidle');
  });

  await test.step('Trigger customer data update', async () => {
    // Simulate customer activity change via API
    await apiClient.post(`/api/customers/${testCustomer.id}/activity`, {
      type: 'usage_decline',
      value: -25,
      timestamp: new Date().toISOString()
    });

    // Wait for real-time update
    await page.waitForResponse(
      response => response.url().includes('/api/risk-assessment')
    );
  });

  await test.step('Verify risk update', async () => {
    // Check updated risk score
    const scoreElement = page.locator('[data-testid="risk-score"]');
    await expect(scoreElement).toHaveAttribute('data-updated', 'true');

    // Verify risk factors reflect change
    const usageFactorElement = page.locator('[data-testid="risk-factor-usage"]');
    await expect(usageFactorElement).toContainText('Usage Decline');
    await expect(usageFactorElement).toHaveClass(/increased/);
  });
});

test('should recommend appropriate interventions', async ({ page }) => {
  // Use high-risk customer for testing interventions
  const highRiskCustomer = testData.customers.find(c => c.expectedRiskLevel === 'HIGH');
  expect(highRiskCustomer).toBeDefined();

  await test.step('Load high-risk customer', async () => {
    await page.goto(`${BASE_URL}/customers/${highRiskCustomer!.id}/risk`);
    await page.waitForLoadState('networkidle');
  });

  await test.step('Verify intervention recommendations', async () => {
    const recommendationsSection = page.locator('[data-testid="intervention-recommendations"]');
    await expect(recommendationsSection).toBeVisible();

    // Check for prioritized recommendations
    const recommendations = page.locator('[data-testid="recommendation-item"]');
    await expect(recommendations).toHaveCount.greaterThan(0);

    // Verify recommendation details
    const firstRecommendation = recommendations.first();
    await expect(firstRecommendation).toContainText(/Priority:/);
    await expect(firstRecommendation).toContainText(/Impact:/);
    await expect(firstRecommendation).toContainText(/Action Required/);
  });

  await test.step('Validate playbook suggestions', async () => {
    const playbookSection = page.locator('[data-testid="suggested-playbooks"]');
    await expect(playbookSection).toBeVisible();

    // Verify playbook relevance
    const playbooks = page.locator('[data-testid="playbook-item"]');
    for (const playbook of await playbooks.all()) {
      await expect(playbook).toHaveAttribute('data-risk-level', highRiskCustomer!.expectedRiskLevel);
    }
  });
});

test('should handle error states gracefully', async ({ page }) => {
  await test.step('Handle API timeout', async () => {
    // Force API timeout
    await page.route('**/api/risk-assessment/**', route => 
      new Promise(resolve => setTimeout(resolve, TEST_TIMEOUT + 1000))
    );

    await page.goto(`${BASE_URL}/customers/${testData.customers[0].id}/risk`);
    
    const errorMessage = page.locator('[data-testid="error-message"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText(/timeout/i);
  });

  await test.step('Handle data validation errors', async () => {
    // Simulate invalid data response
    await page.route('**/api/risk-assessment/**', route => 
      route.fulfill({
        status: 400,
        body: JSON.stringify({
          error: 'Invalid risk assessment data'
        })
      })
    );

    await page.reload();

    const errorState = page.locator('[data-testid="risk-assessment-error"]');
    await expect(errorState).toBeVisible();
    await expect(errorState).toContainText(/invalid data/i);
  });

  await test.step('Verify fallback behavior', async () => {
    // Check if fallback UI is shown
    const fallbackView = page.locator('[data-testid="risk-assessment-fallback"]');
    await expect(fallbackView).toBeVisible();
    
    // Verify retry mechanism
    const retryButton = page.locator('[data-testid="retry-button"]');
    await expect(retryButton).toBeVisible();
    await retryButton.click();
    
    // Verify error logging
    const metrics = apiClient.getMetrics();
    expect(metrics.errors.count).toBeGreaterThan(0);
  });
});