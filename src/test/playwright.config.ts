/**
 * Playwright configuration for Customer Success AI Platform end-to-end testing
 * Provides comprehensive test execution settings with enterprise-grade capabilities
 * @version 1.0.0
 * @package @customer-success-ai/test
 */

import { PlaywrightTestConfig, devices } from '@playwright/test'; // v1.40.x
import { loadEnvironmentConfig } from './src/config/test-environment';

// Global configuration constants
const USE_WEBSERVER = process.env.CI ? true : false;
const WEBSERVER_PORT = process.env.PORT || 3000;
const MAX_TEST_PARALLEL = process.env.CI ? 8 : 4;
const PERFORMANCE_THRESHOLD = 3000; // 3s performance requirement

/**
 * Enterprise-grade Playwright configuration with comprehensive test coverage
 */
const config: PlaywrightTestConfig = {
  // Test directory and file configuration
  testDir: './src/e2e',
  timeout: 30000,
  retries: 2,
  workers: MAX_TEST_PARALLEL,

  // Comprehensive test reporting configuration
  reporter: [
    ['html', { open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['json', { outputFile: 'test-results/test-results.json' }],
    ['list']
  ],

  // Global test configuration
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: PERFORMANCE_THRESHOLD,
    testIdAttribute: 'data-testid'
  },

  // Multi-browser and device testing configuration
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 720 },
        launchOptions: {
          args: [
            '--disable-gpu',
            '--no-sandbox',
            '--disable-dev-shm-usage'
          ]
        }
      }
    },
    {
      name: 'firefox',
      use: {
        browserName: 'firefox',
        viewport: { width: 1280, height: 720 }
      }
    },
    {
      name: 'webkit',
      use: {
        browserName: 'webkit',
        viewport: { width: 1280, height: 720 }
      }
    },
    {
      name: 'mobile-chrome',
      use: {
        browserName: 'chromium',
        ...devices['Pixel 5'],
        launchOptions: {
          args: [
            '--disable-gpu',
            '--no-sandbox'
          ]
        }
      }
    },
    {
      name: 'mobile-safari',
      use: {
        browserName: 'webkit',
        ...devices['iPhone 12']
      }
    }
  ],

  // Development server configuration
  webServer: {
    command: 'npm run dev',
    port: WEBSERVER_PORT,
    reuseExistingServer: true,
    timeout: 120000
  },

  // Test assertion configuration
  expect: {
    timeout: PERFORMANCE_THRESHOLD,
    toMatchSnapshot: {
      maxDiffPixels: 50
    }
  },

  // Advanced test execution configuration
  fullyParallel: true,
  forbidOnly: process.env.CI ? true : false,
  maxFailures: process.env.CI ? 10 : undefined,
  preserveOutput: 'failures-only',
  updateSnapshots: 'none'
};

export default config;