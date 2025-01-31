/**
 * End-to-end test suite for authentication functionality in the Customer Success AI Platform
 * Tests credential-based login, SSO flows, MFA verification, and security compliance
 * @version 1.0.0
 * @package @customer-success-ai/test
 */

import { test, expect } from '@playwright/test';
import { AxeBuilder } from 'axe-playwright';
import { setupTestEnvironment, teardownTestEnvironment } from '../../utils/test-helpers';
import ApiClient from '../../utils/api-client';

// Test configuration constants
const TEST_USER = {
  email: 'test@example.com',
  password: 'testPassword123',
  mfaSecret: 'BASE32SECRET'
};

const INVALID_USER = {
  email: 'invalid@example.com',
  password: 'wrongpass'
};

const TEST_CONFIG = {
  rateLimitThreshold: 100,
  performanceThreshold: 3000,
  retryAttempts: 3
};

// Test environment setup
let testEnv: any;
let apiClient: ApiClient;

test.beforeAll(async () => {
  testEnv = await setupTestEnvironment();
  apiClient = new ApiClient('development', {
    enableMetrics: true,
    enableCircuitBreaker: true,
    maxRetries: TEST_CONFIG.retryAttempts
  });
});

test.afterAll(async () => {
  await teardownTestEnvironment(testEnv);
});

test.describe('Authentication E2E Tests', () => {
  test('should successfully login with valid credentials', async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');

    // Verify security headers
    const response = await page.waitForResponse(resp => resp.url().includes('/login'));
    expect(response.headers()['strict-transport-security']).toBeDefined();
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
    expect(response.headers()['x-frame-options']).toBe('DENY');

    // Fill login form
    await page.fill('[data-testid="email-input"]', TEST_USER.email);
    await page.fill('[data-testid="password-input"]', TEST_USER.password);

    // Verify CSRF token presence
    const csrfToken = await page.getAttribute('meta[name="csrf-token"]', 'content');
    expect(csrfToken).toBeTruthy();

    // Submit login form and measure response time
    const startTime = Date.now();
    await Promise.all([
      page.click('[data-testid="login-button"]'),
      page.waitForNavigation()
    ]);
    const responseTime = Date.now() - startTime;
    expect(responseTime).toBeLessThan(TEST_CONFIG.performanceThreshold);

    // Verify successful login
    expect(page.url()).toContain('/dashboard');
    const sessionCookie = await page.context().cookies();
    expect(sessionCookie.find(c => c.name === 'session')).toBeTruthy();
    expect(sessionCookie[0].secure).toBe(true);
    expect(sessionCookie[0].httpOnly).toBe(true);
    expect(sessionCookie[0].sameSite).toBe('Lax');
  });

  test('should handle invalid login attempts with proper error handling', async ({ page }) => {
    await page.goto('/login');

    // Test rate limiting
    for (let i = 0; i < TEST_CONFIG.rateLimitThreshold + 1; i++) {
      await page.fill('[data-testid="email-input"]', INVALID_USER.email);
      await page.fill('[data-testid="password-input"]', INVALID_USER.password);
      await page.click('[data-testid="login-button"]');
    }

    const response = await page.waitForResponse(resp => resp.url().includes('/login'));
    expect(response.status()).toBe(429);
    expect(response.headers()['retry-after']).toBeDefined();
  });

  test('should complete MFA verification successfully', async ({ page }) => {
    await page.goto('/login');

    // Complete initial login
    await page.fill('[data-testid="email-input"]', TEST_USER.email);
    await page.fill('[data-testid="password-input"]', TEST_USER.password);
    await page.click('[data-testid="login-button"]');

    // Verify MFA screen
    await page.waitForSelector('[data-testid="mfa-input"]');
    expect(page.url()).toContain('/mfa-verification');

    // Generate and submit valid TOTP code
    const totpCode = generateTOTP(TEST_USER.mfaSecret);
    await page.fill('[data-testid="mfa-input"]', totpCode);
    await page.click('[data-testid="verify-button"]');

    // Verify successful MFA completion
    await page.waitForNavigation();
    expect(page.url()).toContain('/dashboard');

    // Verify remember device functionality
    const deviceCookie = await page.context().cookies();
    expect(deviceCookie.find(c => c.name === 'device_token')).toBeTruthy();
  });

  test('should meet WCAG 2.1 Level AA accessibility requirements', async ({ page }) => {
    await page.goto('/login');

    // Run automated accessibility tests
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toHaveLength(0);

    // Test keyboard navigation
    await page.keyboard.press('Tab');
    let focusedElement = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    expect(focusedElement).toBe('email-input');

    await page.keyboard.press('Tab');
    focusedElement = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    expect(focusedElement).toBe('password-input');

    // Verify ARIA attributes
    const emailInput = await page.getAttribute('[data-testid="email-input"]', 'aria-label');
    expect(emailInput).toBe('Email address');

    const passwordInput = await page.getAttribute('[data-testid="password-input"]', 'aria-label');
    expect(passwordInput).toBe('Password');

    // Test error announcements
    await page.fill('[data-testid="email-input"]', 'invalid');
    await page.click('[data-testid="login-button"]');
    
    const errorMessage = await page.getAttribute('[role="alert"]', 'aria-live');
    expect(errorMessage).toBe('assertive');
  });

  test('should handle SSO authentication flow', async ({ page }) => {
    await page.goto('/login');

    // Click SSO button
    await page.click('[data-testid="sso-button"]');

    // Verify redirect to Blitzy SSO
    expect(page.url()).toContain('blitzy.com/sso');

    // Mock SSO response
    await page.route('**/saml/acs', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          success: true,
          token: 'valid_sso_token'
        })
      });
    });

    // Complete SSO flow
    await page.click('[data-testid="sso-continue"]');
    await page.waitForNavigation();

    // Verify successful SSO login
    expect(page.url()).toContain('/dashboard');
    const ssoToken = await page.evaluate(() => localStorage.getItem('sso_token'));
    expect(ssoToken).toBeTruthy();
  });
});

/**
 * Helper function to generate TOTP code for testing
 * @param secret MFA secret key
 * @returns Generated TOTP code
 */
function generateTOTP(secret: string): string {
  // Mock TOTP generation for testing
  return '123456';
}