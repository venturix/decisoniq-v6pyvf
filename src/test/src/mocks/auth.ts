import { jest } from '@jest/globals';
import { User, LoginCredentials } from '../../web/src/types/auth';
import { TestDataGenerator } from '../utils/test-data-generator';

// Initialize test data generator with secure configuration
const testDataGenerator = new TestDataGenerator({
  seed: Date.now(),
  piiMasking: true,
  performanceTracking: true
});

/**
 * Interface for enhanced API responses with security context
 */
interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
  securityContext?: {
    tokenHash: string;
    requestId: string;
    rateLimit: {
      remaining: number;
      reset: number;
    };
  };
}

/**
 * Interface for authentication context with security metadata
 */
interface AuthContext {
  ipAddress: string;
  userAgent: string;
  deviceId?: string;
  geoLocation?: {
    country: string;
    region: string;
  };
  requestId: string;
}

/**
 * Interface for SSO authentication context
 */
interface SSOContext {
  samlResponse: string;
  relayState: string;
  idpMetadata: Record<string, unknown>;
  requestId: string;
}

/**
 * Interface for MFA verification context
 */
interface MFAContext {
  tempToken: string;
  deviceFingerprint: string;
  attempts: number;
  requestId: string;
}

/**
 * Mock authentication responses for testing scenarios
 */
export const mockAuthResponses = {
  validToken: {
    accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    expiresIn: 3600,
    tokenType: 'Bearer' as const,
    scope: 'full_access'
  },
  invalidCredentialsError: {
    code: 'AUTH001',
    message: 'Invalid email or password',
    status: 401
  },
  invalidSSOError: {
    code: 'AUTH002',
    message: 'Invalid SAML response',
    status: 401
  },
  invalidMFAError: {
    code: 'AUTH003',
    message: 'Invalid MFA code',
    status: 401
  },
  rateLimitExceededError: {
    code: 'AUTH004',
    message: 'Rate limit exceeded',
    status: 429
  },
  tokenRotationError: {
    code: 'AUTH005',
    message: 'Token rotation failed',
    status: 400
  }
};

/**
 * Enhanced mock implementation of email/password login with security validation
 * @param credentials Login credentials
 * @param context Authentication context
 */
export const mockLoginWithCredentials = jest.fn(
  async (credentials: LoginCredentials, context: AuthContext): Promise<ApiResponse<any>> => {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(credentials.email)) {
      return {
        data: mockAuthResponses.invalidCredentialsError,
        status: 401,
        headers: {
          'x-request-id': context.requestId
        }
      };
    }

    // Validate password complexity
    if (credentials.password.length < 8) {
      return {
        data: mockAuthResponses.invalidCredentialsError,
        status: 401,
        headers: {
          'x-request-id': context.requestId
        }
      };
    }

    // Check rate limiting
    const rateLimitKey = `${context.ipAddress}:${credentials.email}`;
    const rateLimit = getRateLimit(rateLimitKey);
    if (rateLimit.remaining === 0) {
      return {
        data: mockAuthResponses.rateLimitExceededError,
        status: 429,
        headers: {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': rateLimit.reset.toString(),
          'x-request-id': context.requestId
        }
      };
    }

    // Return successful login response
    return {
      data: {
        ...mockAuthResponses.validToken,
        user: await testDataGenerator.generateAuthData()
      },
      status: 200,
      headers: {
        'x-request-id': context.requestId,
        'x-ratelimit-remaining': rateLimit.remaining.toString()
      },
      securityContext: {
        tokenHash: generateTokenHash(mockAuthResponses.validToken.accessToken),
        requestId: context.requestId,
        rateLimit
      }
    };
  }
);

/**
 * Enhanced mock implementation of SSO login with SAML support
 * @param context SSO authentication context
 */
export const mockLoginWithSSO = jest.fn(
  async (context: SSOContext): Promise<ApiResponse<any>> => {
    // Validate SAML response
    if (!context.samlResponse || !context.idpMetadata) {
      return {
        data: mockAuthResponses.invalidSSOError,
        status: 401,
        headers: {
          'x-request-id': context.requestId
        }
      };
    }

    // Generate mock SAML validation result
    const samlValidation = await testDataGenerator.generateSAMLResponse();

    // Return successful SSO login response
    return {
      data: {
        ...mockAuthResponses.validToken,
        samlAssertion: samlValidation
      },
      status: 200,
      headers: {
        'x-request-id': context.requestId
      },
      securityContext: {
        tokenHash: generateTokenHash(mockAuthResponses.validToken.accessToken),
        requestId: context.requestId,
        rateLimit: { remaining: 100, reset: Date.now() + 3600000 }
      }
    };
  }
);

/**
 * Enhanced mock implementation of token refresh with rotation
 * @param currentToken Current access token
 * @param context Authentication context
 */
export const mockRefreshToken = jest.fn(
  async (currentToken: string, context: AuthContext): Promise<ApiResponse<any>> => {
    // Validate current token
    if (!isValidToken(currentToken)) {
      return {
        data: mockAuthResponses.tokenRotationError,
        status: 400,
        headers: {
          'x-request-id': context.requestId
        }
      };
    }

    // Generate new token pair
    const newToken = await testDataGenerator.generateMockToken();

    return {
      data: {
        ...newToken,
        previousTokenHash: generateTokenHash(currentToken)
      },
      status: 200,
      headers: {
        'x-request-id': context.requestId
      },
      securityContext: {
        tokenHash: generateTokenHash(newToken.accessToken),
        requestId: context.requestId,
        rateLimit: { remaining: 100, reset: Date.now() + 3600000 }
      }
    };
  }
);

/**
 * Enhanced mock implementation of MFA verification with device binding
 * @param mfaCode MFA verification code
 * @param context MFA context
 */
export const mockVerifyMFA = jest.fn(
  async (mfaCode: string, context: MFAContext): Promise<ApiResponse<any>> => {
    // Validate MFA code format
    const mfaRegex = /^\d{6}$/;
    if (!mfaRegex.test(mfaCode)) {
      return {
        data: mockAuthResponses.invalidMFAError,
        status: 401,
        headers: {
          'x-request-id': context.requestId
        }
      };
    }

    // Check attempt limits
    if (context.attempts >= 3) {
      return {
        data: {
          code: 'AUTH006',
          message: 'Maximum MFA attempts exceeded',
          status: 403
        },
        status: 403,
        headers: {
          'x-request-id': context.requestId
        }
      };
    }

    return {
      data: {
        verified: true,
        deviceBound: true,
        deviceFingerprint: context.deviceFingerprint
      },
      status: 200,
      headers: {
        'x-request-id': context.requestId
      },
      securityContext: {
        tokenHash: generateTokenHash(context.tempToken),
        requestId: context.requestId,
        rateLimit: { remaining: 100, reset: Date.now() + 3600000 }
      }
    };
  }
);

// Helper functions
function generateTokenHash(token: string): string {
  return `sha256:${Buffer.from(token).toString('base64')}`;
}

function getRateLimit(key: string): { remaining: number; reset: number } {
  return {
    remaining: 100,
    reset: Date.now() + 3600000
  };
}

function isValidToken(token: string): boolean {
  return token.startsWith('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
}