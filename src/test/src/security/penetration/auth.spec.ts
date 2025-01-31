import { describe, test, beforeAll, afterAll, expect } from '@jest/globals'; // v29.x
import jwtDecode from 'jwt-decode'; // v4.x
import { createHash, randomBytes } from 'crypto'; // latest

import ApiClient from '../../utils/api-client';
import { setupTestEnvironment, teardownTestEnvironment } from '../../utils/test-helpers';

/**
 * Comprehensive authentication penetration testing suite
 * Tests security mechanisms, token management, and authentication flows
 */
@describe('Authentication Security Tests')
export class AuthPenetrationTest {
  private apiClient: ApiClient;
  private testUsers: {
    valid: { email: string; password: string }[];
    invalid: { email: string; password: string }[];
  };
  private securityHeaders: string[];
  private performanceMetrics: {
    responseTimes: number[];
    successRate: number;
    concurrentLoad: number;
  };

  constructor() {
    this.apiClient = new ApiClient('development', {
      timeout: 5000,
      enableRetry: false,
      enableMetrics: true
    });

    this.testUsers = {
      valid: [
        { email: 'test@example.com', password: 'ValidP@ssw0rd123!' },
        { email: 'admin@example.com', password: 'SecureP@ssw0rd456!' }
      ],
      invalid: [
        { email: 'invalid@example', password: 'short' },
        { email: '', password: '' },
        { email: 'sql_injection@example.com', password: "' OR '1'='1" },
        { email: '<script>alert(1)</script>', password: '<script>alert(1)</script>' }
      ]
    };

    this.securityHeaders = [
      'X-Frame-Options',
      'X-Content-Type-Options',
      'X-XSS-Protection',
      'Strict-Transport-Security',
      'Content-Security-Policy'
    ];

    this.performanceMetrics = {
      responseTimes: [],
      successRate: 0,
      concurrentLoad: 0
    };
  }

  @beforeAll
  async setup(): Promise<void> {
    await setupTestEnvironment({
      concurrentUsers: 200,
      performanceTracking: true
    });
  }

  @afterAll
  async cleanup(): Promise<void> {
    await teardownTestEnvironment();
  }

  @test('Should prevent brute force attacks with rate limiting')
  async testBruteForceProtection(): Promise<void> {
    const testUser = this.testUsers.valid[0];
    const attempts = 200; // Test high volume of requests
    const concurrentRequests = Array(attempts).fill(null).map(() => 
      this.apiClient.post('/auth/login', {
        email: testUser.email,
        password: 'WrongPassword123!'
      })
    );

    const results = await Promise.allSettled(concurrentRequests);
    const rateLimited = results.filter(r => 
      r.status === 'fulfilled' && r.value.statusCode === 429
    ).length;

    // Verify rate limiting is working
    expect(rateLimited).toBeGreaterThan(0);
    
    // Check for account lockout after multiple failures
    const finalAttempt = await this.apiClient.post('/auth/login', {
      email: testUser.email,
      password: testUser.password
    });

    expect(finalAttempt.statusCode).toBe(403);
    expect(finalAttempt.error).toContain('account locked');
  }

  @test('Should validate JWT token security')
  async testTokenSecurity(): Promise<void> {
    // Test valid authentication
    const loginResponse = await this.apiClient.post('/auth/login', this.testUsers.valid[0]);
    expect(loginResponse.success).toBe(true);
    
    const token = loginResponse.data.accessToken;
    const decodedToken: any = jwtDecode(token);

    // Validate token structure
    expect(decodedToken).toHaveProperty('exp');
    expect(decodedToken).toHaveProperty('iat');
    expect(decodedToken).toHaveProperty('sub');
    expect(decodedToken.aud).toBe('customer-success-ai');
    
    // Test token expiration
    const expiredToken = this.generateExpiredToken();
    this.apiClient.setAuthToken(expiredToken);
    const expiredResponse = await this.apiClient.get('/api/protected');
    expect(expiredResponse.statusCode).toBe(401);

    // Test token tampering
    const tamperedToken = this.tamperToken(token);
    this.apiClient.setAuthToken(tamperedToken);
    const tamperedResponse = await this.apiClient.get('/api/protected');
    expect(tamperedResponse.statusCode).toBe(401);
  }

  @test('Should prevent SSO vulnerabilities')
  async testSSOVulnerabilities(): Promise<void> {
    // Test SAML response injection
    const maliciousSAMLResponse = this.generateMaliciousSAMLResponse();
    const ssoResponse = await this.apiClient.post('/auth/sso/callback', {
      SAMLResponse: maliciousSAMLResponse,
      RelayState: 'original_url'
    });
    expect(ssoResponse.statusCode).toBe(400);

    // Test signature validation
    const unsignedSAMLResponse = this.generateUnsignedSAMLResponse();
    const unsignedResponse = await this.apiClient.post('/auth/sso/callback', {
      SAMLResponse: unsignedSAMLResponse,
      RelayState: 'original_url'
    });
    expect(unsignedResponse.statusCode).toBe(400);

    // Test replay attack
    const validSAMLResponse = await this.getValidSAMLResponse();
    const firstResponse = await this.apiClient.post('/auth/sso/callback', {
      SAMLResponse: validSAMLResponse,
      RelayState: 'original_url'
    });
    expect(firstResponse.success).toBe(true);

    const replayResponse = await this.apiClient.post('/auth/sso/callback', {
      SAMLResponse: validSAMLResponse,
      RelayState: 'original_url'
    });
    expect(replayResponse.statusCode).toBe(400);
  }

  @test('Should prevent MFA bypass attempts')
  async testMFABypass(): Promise<void> {
    // Test brute force protection
    const mfaCode = '123456';
    const attempts = 10;
    const bruteForceMFA = Array(attempts).fill(null).map(() =>
      this.apiClient.post('/auth/mfa/verify', { code: mfaCode })
    );

    const results = await Promise.allSettled(bruteForceMFA);
    const blocked = results.filter(r => 
      r.status === 'fulfilled' && r.value.statusCode === 429
    ).length;
    expect(blocked).toBeGreaterThan(0);

    // Test code reuse
    const validCode = await this.generateValidMFACode();
    const firstVerification = await this.apiClient.post('/auth/mfa/verify', {
      code: validCode
    });
    expect(firstVerification.success).toBe(true);

    const reuseAttempt = await this.apiClient.post('/auth/mfa/verify', {
      code: validCode
    });
    expect(reuseAttempt.statusCode).toBe(400);

    // Test timing attack protection
    const timingResults = await this.testMFATimingAttack();
    expect(timingResults.variance).toBeLessThan(50); // Max 50ms variance
  }

  // Helper methods
  private generateExpiredToken(): string {
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
      exp: Math.floor(Date.now() / 1000) - 3600,
      iat: Math.floor(Date.now() / 1000) - 7200,
      sub: 'test-user',
      aud: 'customer-success-ai'
    };
    return this.generateToken(header, payload);
  }

  private tamperToken(token: string): string {
    const [header, payload, signature] = token.split('.');
    const decodedPayload = JSON.parse(Buffer.from(payload, 'base64').toString());
    decodedPayload.roles = ['admin'];
    const tamperedPayload = Buffer.from(JSON.stringify(decodedPayload)).toString('base64');
    return `${header}.${tamperedPayload}.${signature}`;
  }

  private generateToken(header: any, payload: any): string {
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signature = createHash('sha256')
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64');
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  private generateMaliciousSAMLResponse(): string {
    return Buffer.from('<saml:Response><!-- XML injection --></saml:Response>').toString('base64');
  }

  private generateUnsignedSAMLResponse(): string {
    return Buffer.from('<saml:Response><saml:Assertion></saml:Assertion></saml:Response>').toString('base64');
  }

  private async getValidSAMLResponse(): Promise<string> {
    return Buffer.from(randomBytes(32)).toString('base64');
  }

  private async generateValidMFACode(): Promise<string> {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async testMFATimingAttack(): Promise<{ variance: number }> {
    const timings: number[] = [];
    const attempts = 100;

    for (let i = 0; i < attempts; i++) {
      const start = process.hrtime();
      await this.apiClient.post('/auth/mfa/verify', {
        code: Math.floor(100000 + Math.random() * 900000).toString()
      });
      const [seconds, nanoseconds] = process.hrtime(start);
      timings.push(seconds * 1000 + nanoseconds / 1000000);
    }

    const variance = Math.max(...timings) - Math.min(...timings);
    return { variance };
  }
}