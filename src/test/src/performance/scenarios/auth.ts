/**
 * Performance test scenarios for authentication operations in the Customer Success AI Platform
 * Tests login, SSO, and token refresh flows with comprehensive metrics collection
 * @version 1.0.0
 * @package @customer-success-ai/test
 */

// External imports
import { check } from 'k6'; // v0.45.x
import { sleep } from 'k6'; // v0.45.x
import { group } from 'k6'; // v0.45.x
import { Rate } from 'k6/metrics'; // v0.45.x

// Internal imports
import { ApiClient } from '../../utils/api-client';
import { defaultThresholds } from '../../config/performance-thresholds';

/**
 * Configuration options for auth performance scenarios
 */
interface AuthScenarioOptions {
  vus: number;
  duration: number;
  maxRequestDuration: number;
  enableMetrics: boolean;
  thresholds?: Record<string, string[]>;
}

/**
 * Test context for auth scenarios
 */
interface AuthTestContext {
  client: ApiClient;
  authToken: string;
  metrics: {
    loginSuccess: Rate;
    ssoSuccess: Rate;
    refreshSuccess: Rate;
  };
}

/**
 * Default configuration for auth performance tests
 */
const DEFAULT_OPTIONS: AuthScenarioOptions = {
  vus: 200, // Support 200 concurrent enterprise users
  duration: 300, // 5 minute test duration
  maxRequestDuration: 3000, // 3s max request duration
  enableMetrics: true,
  thresholds: {
    'http_req_duration': ['p(95)<3000'], // 95% of requests under 3s
    'http_req_failed': ['rate<0.01'], // 99.9% success rate
    'sso_auth_duration': ['p(99)<5000'] // 99% of SSO auth under 5s
  }
};

/**
 * Performance test scenario for user login flow
 * @param options Test configuration options
 */
export function loginScenario(options: AuthScenarioOptions = DEFAULT_OPTIONS) {
  const context: AuthTestContext = {
    client: new ApiClient('staging', {
      enableMetrics: options.enableMetrics,
      timeout: options.maxRequestDuration
    }),
    authToken: '',
    metrics: {
      loginSuccess: new Rate('login_success_rate'),
      ssoSuccess: new Rate('sso_success_rate'),
      refreshSuccess: new Rate('refresh_success_rate')
    }
  };

  group('Login Performance Tests', () => {
    // Test standard login flow
    const loginResult = context.client.post('/auth/login', {
      username: `test.user${__VU}@example.com`,
      password: 'TestPassword123!'
    });

    check(loginResult, {
      'login successful': (r) => r.success,
      'response time OK': (r) => r.responseTime < options.maxRequestDuration,
      'token received': (r) => r.data?.token?.length > 0
    });

    if (loginResult.success) {
      context.authToken = loginResult.data.token;
      context.metrics.loginSuccess.add(1);
      context.client.setAuthToken(context.authToken);
    }

    sleep(1); // Prevent rate limiting
  });
}

/**
 * Performance test scenario for SSO authentication flow
 * @param options Test configuration options
 */
export function ssoScenario(options: AuthScenarioOptions = DEFAULT_OPTIONS) {
  const context: AuthTestContext = {
    client: new ApiClient('staging', {
      enableMetrics: options.enableMetrics,
      timeout: options.maxRequestDuration
    }),
    authToken: '',
    metrics: {
      loginSuccess: new Rate('login_success_rate'),
      ssoSuccess: new Rate('sso_success_rate'),
      refreshSuccess: new Rate('refresh_success_rate')
    }
  };

  group('SSO Performance Tests', () => {
    // Test SAML SSO flow
    const ssoResult = context.client.post('/auth/sso/initiate', {
      email: `test.user${__VU}@example.com`,
      provider: 'blitzy-sso'
    });

    check(ssoResult, {
      'SSO initiation successful': (r) => r.success,
      'SAML response received': (r) => r.data?.samlResponse?.length > 0,
      'response time OK': (r) => r.responseTime < options.maxRequestDuration
    });

    if (ssoResult.success) {
      // Complete SSO authentication
      const authResult = context.client.post('/auth/sso/complete', {
        samlResponse: ssoResult.data.samlResponse
      });

      check(authResult, {
        'SSO auth successful': (r) => r.success,
        'token received': (r) => r.data?.token?.length > 0
      });

      if (authResult.success) {
        context.authToken = authResult.data.token;
        context.metrics.ssoSuccess.add(1);
        context.client.setAuthToken(context.authToken);
      }
    }

    sleep(1); // Prevent rate limiting
  });
}

/**
 * Performance test scenario for token refresh operations
 * @param options Test configuration options
 */
export function tokenRefreshScenario(options: AuthScenarioOptions = DEFAULT_OPTIONS) {
  const context: AuthTestContext = {
    client: new ApiClient('staging', {
      enableMetrics: options.enableMetrics,
      timeout: options.maxRequestDuration
    }),
    authToken: '',
    metrics: {
      loginSuccess: new Rate('login_success_rate'),
      ssoSuccess: new Rate('sso_success_rate'),
      refreshSuccess: new Rate('refresh_success_rate')
    }
  };

  group('Token Refresh Performance Tests', () => {
    // Initial login to get token
    const loginResult = context.client.post('/auth/login', {
      username: `test.user${__VU}@example.com`,
      password: 'TestPassword123!'
    });

    if (loginResult.success) {
      context.authToken = loginResult.data.token;
      context.client.setAuthToken(context.authToken);

      // Test token refresh
      const refreshResult = context.client.post('/auth/token/refresh', {
        token: context.authToken
      });

      check(refreshResult, {
        'refresh successful': (r) => r.success,
        'new token received': (r) => r.data?.token?.length > 0,
        'response time OK': (r) => r.responseTime < options.maxRequestDuration
      });

      if (refreshResult.success) {
        context.authToken = refreshResult.data.token;
        context.metrics.refreshSuccess.add(1);
        context.client.setAuthToken(context.authToken);
      }
    }

    sleep(1); // Prevent rate limiting
  });
}