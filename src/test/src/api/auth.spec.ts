/**
 * Authentication API Test Suite
 * Comprehensive test coverage for authentication flows, security, and performance
 * @version 1.0.0
 * @package @customer-success-ai/test
 */

// External imports
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'; // v29.x

// Internal imports
import ApiClient from '../utils/api-client';
import TestDataGenerator from '../utils/test-data-generator';

// Test configuration constants
const AUTH_CONFIG = {
  RESPONSE_TIME_THRESHOLD: 3000, // 3 seconds max
  RATE_LIMIT: {
    LOGIN: 1000,
    SSO: 500,
    MFA: 200
  },
  TOKEN_EXPIRY: 3600, // 1 hour
  MFA_CODE_LENGTH: 6
};

describe('Authentication API', () => {
  let apiClient: ApiClient;
  let testDataGenerator: TestDataGenerator;
  let testUser: any;
  let ssoPayload: any;

  beforeEach(async () => {
    // Initialize API client with test configuration
    apiClient = new ApiClient('development', {
      baseURL: 'http://localhost:8000',
      timeout: 5000,
      enableMetrics: true
    });

    // Initialize test data generator
    testDataGenerator = new TestDataGenerator({
      seed: Date.now(),
      piiMasking: true
    });

    // Generate test data
    testUser = await testDataGenerator.generateTestUser();
    ssoPayload = await testDataGenerator.generateSSOPayload();

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clear authentication state
    apiClient.setAuthToken('');
  });

  describe('Email/Password Authentication', () => {
    it('should successfully authenticate with valid credentials', async () => {
      const response = await apiClient.post('/auth/login', {
        email: testUser.email,
        password: testUser.password
      });

      expect(response.success).toBe(true);
      expect(response.statusCode).toBe(200);
      expect(response.data).toHaveProperty('token');
      expect(response.data).toHaveProperty('user');
      expect(response.responseTime).toBeLessThan(AUTH_CONFIG.RESPONSE_TIME_THRESHOLD);
    });

    it('should fail authentication with invalid credentials', async () => {
      const response = await apiClient.post('/auth/login', {
        email: testUser.email,
        password: 'wrongpassword'
      });

      expect(response.success).toBe(false);
      expect(response.statusCode).toBe(401);
      expect(response.error).toBe('Invalid credentials');
    });

    it('should enforce password complexity requirements', async () => {
      const response = await apiClient.post('/auth/login', {
        email: testUser.email,
        password: 'simple'
      });

      expect(response.success).toBe(false);
      expect(response.statusCode).toBe(400);
      expect(response.error).toContain('Password complexity');
    });

    it('should implement rate limiting for failed attempts', async () => {
      const attempts = Array(6).fill(null).map(() => 
        apiClient.post('/auth/login', {
          email: testUser.email,
          password: 'wrongpassword'
        })
      );

      const responses = await Promise.all(attempts);
      const lastResponse = responses[responses.length - 1];

      expect(lastResponse.statusCode).toBe(429);
      expect(lastResponse.error).toContain('Too many attempts');
    });
  });

  describe('SSO Authentication', () => {
    it('should successfully authenticate with valid SAML response', async () => {
      const response = await apiClient.post('/auth/sso/callback', ssoPayload);

      expect(response.success).toBe(true);
      expect(response.statusCode).toBe(200);
      expect(response.data).toHaveProperty('token');
      expect(response.data.user.ssoProvider).toBe(ssoPayload.provider);
      expect(response.responseTime).toBeLessThan(AUTH_CONFIG.RESPONSE_TIME_THRESHOLD);
    });

    it('should validate SAML signature and assertions', async () => {
      const invalidPayload = {
        ...ssoPayload,
        signature: 'invalid'
      };

      const response = await apiClient.post('/auth/sso/callback', invalidPayload);

      expect(response.success).toBe(false);
      expect(response.statusCode).toBe(400);
      expect(response.error).toContain('Invalid SAML signature');
    });

    it('should handle SSO provider errors gracefully', async () => {
      const errorPayload = {
        error: 'access_denied',
        error_description: 'User denied access'
      };

      const response = await apiClient.post('/auth/sso/callback', errorPayload);

      expect(response.success).toBe(false);
      expect(response.statusCode).toBe(400);
      expect(response.error).toContain('SSO authentication failed');
    });
  });

  describe('MFA Verification', () => {
    let mfaToken: string;

    beforeEach(async () => {
      // Setup MFA challenge
      const loginResponse = await apiClient.post('/auth/login', {
        email: testUser.email,
        password: testUser.password
      });
      mfaToken = loginResponse.data.mfaToken;
    });

    it('should successfully verify valid MFA code', async () => {
      const response = await apiClient.post('/auth/mfa/verify', {
        token: mfaToken,
        code: '123456'
      });

      expect(response.success).toBe(true);
      expect(response.statusCode).toBe(200);
      expect(response.data).toHaveProperty('token');
      expect(response.responseTime).toBeLessThan(AUTH_CONFIG.RESPONSE_TIME_THRESHOLD);
    });

    it('should reject invalid MFA codes', async () => {
      const response = await apiClient.post('/auth/mfa/verify', {
        token: mfaToken,
        code: '000000'
      });

      expect(response.success).toBe(false);
      expect(response.statusCode).toBe(401);
      expect(response.error).toContain('Invalid MFA code');
    });

    it('should enforce MFA code expiry', async () => {
      // Wait for token expiry
      await new Promise(resolve => setTimeout(resolve, 5000));

      const response = await apiClient.post('/auth/mfa/verify', {
        token: mfaToken,
        code: '123456'
      });

      expect(response.success).toBe(false);
      expect(response.statusCode).toBe(401);
      expect(response.error).toContain('MFA code expired');
    });
  });

  describe('Token Management', () => {
    let authToken: string;

    beforeEach(async () => {
      const response = await apiClient.post('/auth/login', {
        email: testUser.email,
        password: testUser.password
      });
      authToken = response.data.token;
    });

    it('should successfully refresh valid tokens', async () => {
      const response = await apiClient.post('/auth/token/refresh', {
        token: authToken
      });

      expect(response.success).toBe(true);
      expect(response.statusCode).toBe(200);
      expect(response.data).toHaveProperty('token');
      expect(response.data.token).not.toBe(authToken);
    });

    it('should reject expired tokens', async () => {
      const expiredToken = 'expired.jwt.token';
      const response = await apiClient.post('/auth/token/refresh', {
        token: expiredToken
      });

      expect(response.success).toBe(false);
      expect(response.statusCode).toBe(401);
      expect(response.error).toContain('Token expired');
    });

    it('should invalidate tokens on logout', async () => {
      const logoutResponse = await apiClient.post('/auth/logout', {
        token: authToken
      });

      expect(logoutResponse.success).toBe(true);

      const verifyResponse = await apiClient.post('/auth/token/verify', {
        token: authToken
      });

      expect(verifyResponse.success).toBe(false);
      expect(verifyResponse.statusCode).toBe(401);
    });
  });

  describe('Security Headers and Protocols', () => {
    it('should include required security headers', async () => {
      const response = await apiClient.post('/auth/login', {
        email: testUser.email,
        password: testUser.password
      });

      const headers = response.headers;
      expect(headers).toHaveProperty('strict-transport-security');
      expect(headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(headers).toHaveProperty('x-frame-options', 'DENY');
      expect(headers).toHaveProperty('x-xss-protection', '1; mode=block');
    });

    it('should enforce TLS requirements', async () => {
      const insecureClient = new ApiClient('development', {
        baseURL: 'http://localhost:8000',
        enableTLS: false
      });

      const response = await insecureClient.post('/auth/login', {
        email: testUser.email,
        password: testUser.password
      });

      expect(response.success).toBe(false);
      expect(response.statusCode).toBe(400);
      expect(response.error).toContain('HTTPS required');
    });
  });

  describe('Performance Metrics', () => {
    it('should meet response time requirements', async () => {
      const startTime = Date.now();
      const response = await apiClient.post('/auth/login', {
        email: testUser.email,
        password: testUser.password
      });
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(AUTH_CONFIG.RESPONSE_TIME_THRESHOLD);
      expect(response.responseTime).toBeLessThan(AUTH_CONFIG.RESPONSE_TIME_THRESHOLD);
    });

    it('should handle concurrent authentication requests', async () => {
      const concurrentRequests = Array(10).fill(null).map(() => 
        apiClient.post('/auth/login', {
          email: testUser.email,
          password: testUser.password
        })
      );

      const responses = await Promise.all(concurrentRequests);
      const allSuccessful = responses.every(r => r.success);
      const allFastEnough = responses.every(r => 
        r.responseTime < AUTH_CONFIG.RESPONSE_TIME_THRESHOLD
      );

      expect(allSuccessful).toBe(true);
      expect(allFastEnough).toBe(true);
    });
  });
});