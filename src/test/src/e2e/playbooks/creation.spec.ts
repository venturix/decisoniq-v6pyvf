/**
 * End-to-end test suite for playbook creation functionality
 * Tests the visual playbook builder interface, step configuration, validation,
 * and saving functionality with comprehensive performance monitoring
 * @version 1.0.0
 */

// External imports
import { test, expect, describe, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals'; // jest@29.x
import { Page, Browser, chromium, BrowserContext } from '@playwright/test'; // playwright@1.x

// Internal imports
import { 
  setupTestEnvironment, 
  teardownTestEnvironment, 
  waitForAsyncOperation, 
  monitorPerformance 
} from '../../utils/test-helpers';
import { TestDataGenerator } from '../../utils/test-data-generator';
import { 
  MockPlaybook, 
  PlaybookTestData, 
  ComplexPlaybookConfig 
} from '../../types/playbook';

// Constants
const TEST_TIMEOUT = 30000;
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const PERFORMANCE_THRESHOLD = 3000;

describe('Playbook Creation E2E Tests', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let testDataGenerator: TestDataGenerator;
  let testEnvironment: any;

  beforeAll(async () => {
    // Initialize test environment with performance monitoring
    testEnvironment = await setupTestEnvironment({
      performanceTracking: true,
      mockResponses: false
    });

    // Initialize test data generator
    testDataGenerator = new TestDataGenerator({
      seed: Date.now(),
      performanceTracking: true,
      piiMasking: true
    });

    // Launch browser with security context
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  });

  afterAll(async () => {
    await teardownTestEnvironment(testEnvironment);
    await browser.close();
  });

  beforeEach(async () => {
    // Create new context for each test
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true
    });

    // Create new page with performance tracking
    page = await context.newPage();
    await page.setDefaultTimeout(TEST_TIMEOUT);
  });

  afterEach(async () => {
    await context.close();
  });

  test('should create a basic playbook successfully', async () => {
    const startTime = Date.now();

    // Navigate to playbook creation page
    await page.goto(`${BASE_URL}/playbooks/create`);
    await page.waitForSelector('[data-testid="playbook-builder"]');

    // Generate test playbook data
    const playbookData = await testDataGenerator.generatePlaybookData(1);
    const testPlaybook = playbookData.playbooks[0];

    // Fill in basic playbook details
    await page.fill('[data-testid="playbook-name"]', testPlaybook.name);
    await page.fill('[data-testid="playbook-description"]', testPlaybook.description);

    // Add trigger conditions
    await page.click('[data-testid="add-trigger"]');
    await page.selectOption('[data-testid="trigger-type"]', 'RISK_SCORE');
    await page.fill('[data-testid="trigger-threshold"]', '80');

    // Add playbook steps
    for (const step of testPlaybook.steps) {
      await page.click('[data-testid="add-step"]');
      await page.selectOption('[data-testid="step-type"]', step.type);
      await page.fill('[data-testid="step-config"]', JSON.stringify(step.config));
    }

    // Save playbook
    await page.click('[data-testid="save-playbook"]');
    await page.waitForSelector('[data-testid="success-message"]');

    // Verify performance
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD);

    // Verify created playbook
    const savedPlaybook = await page.evaluate(() => {
      return document.querySelector('[data-testid="playbook-data"]')?.textContent;
    });
    expect(JSON.parse(savedPlaybook!)).toMatchObject({
      name: testPlaybook.name,
      description: testPlaybook.description,
      steps: expect.arrayContaining(testPlaybook.steps)
    });
  });

  test('should validate required fields and show errors', async () => {
    await page.goto(`${BASE_URL}/playbooks/create`);
    await page.waitForSelector('[data-testid="playbook-builder"]');

    // Try to save without required fields
    await page.click('[data-testid="save-playbook"]');

    // Verify validation errors
    const nameError = await page.textContent('[data-testid="name-error"]');
    expect(nameError).toContain('Name is required');

    const triggerError = await page.textContent('[data-testid="trigger-error"]');
    expect(triggerError).toContain('At least one trigger condition is required');

    const stepsError = await page.textContent('[data-testid="steps-error"]');
    expect(stepsError).toContain('At least one step is required');
  });

  test('should create complex playbook with multiple conditions and parallel steps', async () => {
    const startTime = Date.now();

    // Generate complex playbook test data
    const complexData = await testDataGenerator.generatePlaybookData(1);
    const testPlaybook = complexData.playbooks[0];

    // Navigate to creation page
    await page.goto(`${BASE_URL}/playbooks/create`);
    await page.waitForSelector('[data-testid="playbook-builder"]');

    // Configure multiple trigger conditions
    await page.click('[data-testid="add-trigger"]');
    await page.selectOption('[data-testid="trigger-type"]', 'RISK_SCORE');
    await page.fill('[data-testid="trigger-threshold"]', '80');

    await page.click('[data-testid="add-trigger"]');
    await page.selectOption('[data-testid="trigger-type"]', 'HEALTH_SCORE');
    await page.fill('[data-testid="trigger-threshold"]', '60');

    // Add parallel execution paths
    await page.click('[data-testid="enable-parallel"]');
    
    // Add steps to parallel paths
    for (const step of testPlaybook.steps) {
      await page.click('[data-testid="add-parallel-step"]');
      await page.selectOption('[data-testid="step-type"]', step.type);
      await page.fill('[data-testid="step-config"]', JSON.stringify(step.config));
    }

    // Add conditional branches
    await page.click('[data-testid="add-condition"]');
    await page.fill('[data-testid="condition-expression"]', 'customer.riskScore > 90');

    // Configure error handling
    await page.click('[data-testid="enable-error-handling"]');
    await page.selectOption('[data-testid="error-action"]', 'retry');
    await page.fill('[data-testid="retry-count"]', '3');

    // Save complex playbook
    await page.click('[data-testid="save-playbook"]');
    await page.waitForSelector('[data-testid="success-message"]');

    // Verify performance
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD);

    // Verify complex configuration
    const savedPlaybook = await page.evaluate(() => {
      return document.querySelector('[data-testid="playbook-data"]')?.textContent;
    });
    const parsedPlaybook = JSON.parse(savedPlaybook!);
    
    expect(parsedPlaybook.triggerConditions.length).toBe(2);
    expect(parsedPlaybook.parallelExecution).toBe(true);
    expect(parsedPlaybook.errorHandling).toBeDefined();
    expect(parsedPlaybook.conditionalBranches).toBeDefined();
  });
});