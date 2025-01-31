/**
 * Core API utility module providing enterprise-grade HTTP client functionality
 * @version 1.0.0
 * @package @customer-success-ai/web
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios'; // ^1.6.0
import axiosRetry from 'axios-retry'; // ^3.8.0
import CircuitBreaker from 'opossum'; // ^7.1.0
import { setupCache } from 'axios-cache-adapter'; // ^2.7.3

import { API_CONFIG } from '../config/api';
import type { ApiResponse, ApiError, ApiErrorCode, ErrorCategory } from '../types/api';
import { getAuthToken } from './auth';

// Constants for API client configuration
const REQUEST_TIMEOUT_MS = 30000;
const MAX_RETRIES = 3;
const CACHE_TTL = 300000; // 5 minutes
const CIRCUIT_BREAKER_OPTIONS = {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000
};

/**
 * Cache configuration for API responses
 */
const cache = setupCache({
  maxAge: CACHE_TTL,
  exclude: {
    query: false,
    methods: ['post', 'put', 'delete', 'patch']
  },
  clearOnStale: true,
  clearOnError: true,
  readOnError: true,
  maxSize: 100,
  debug: process.env.NODE_ENV === 'development'
});

/**
 * Creates and configures an axios instance with enterprise features
 */
const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: API_CONFIG.BASE_URL,
    timeout: REQUEST_TIMEOUT_MS,
    adapter: cache.adapter,
    validateStatus: (status) => status >= 200 && status < 300
  });

  // Configure request interceptor
  client.interceptors.request.use(
    async (config) => {
      const token = await getAuthToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Add request tracking headers
      config.headers['X-Request-ID'] = crypto.randomUUID();
      config.headers['X-Client-Timestamp'] = Date.now().toString();

      return config;
    },
    (error) => Promise.reject(error)
  );

  // Configure response interceptor
  client.interceptors.response.use(
    (response) => {
      // Add response timing metrics
      const requestTime = parseInt(response.config.headers['X-Client-Timestamp'] as string);
      const responseTime = Date.now() - requestTime;

      // Log slow responses
      if (responseTime > 3000) {
        console.warn(`Slow API response: ${responseTime}ms for ${response.config.url}`);
      }

      return response;
    },
    (error) => handleApiError(error)
  );

  // Configure retry behavior
  axiosRetry(client, {
    retries: MAX_RETRIES,
    retryDelay: (retryCount) => Math.min(1000 * Math.pow(2, retryCount), 10000),
    retryCondition: (error) => {
      return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
             error.response?.status === 429 ||
             error.response?.status >= 500;
    }
  });

  return client;
};

/**
 * Circuit breaker wrapper for API requests
 */
const createCircuitBreaker = (apiCall: Function) => {
  const breaker = new CircuitBreaker(apiCall, CIRCUIT_BREAKER_OPTIONS);

  breaker.fallback(() => ({
    success: false,
    error: {
      code: ApiErrorCode.RATE001,
      message: 'Service temporarily unavailable',
      category: ErrorCategory.System,
      httpStatus: 503,
      details: {}
    }
  }));

  breaker.on('open', () => {
    console.error('Circuit breaker opened - API service degraded');
  });

  breaker.on('halfOpen', () => {
    console.info('Circuit breaker half-open - attempting recovery');
  });

  breaker.on('close', () => {
    console.info('Circuit breaker closed - API service recovered');
  });

  return breaker;
};

/**
 * Enhanced error handling with detailed mapping and reporting
 */
const handleApiError = async (error: AxiosError): Promise<ApiResponse<null>> => {
  let apiError: ApiError = {
    code: ApiErrorCode.RATE001,
    message: 'An unexpected error occurred',
    category: ErrorCategory.System,
    httpStatus: error.response?.status || 500,
    details: {}
  };

  if (error.response) {
    const { status, data } = error.response;

    // Map specific error responses
    switch (status) {
      case 401:
        apiError = {
          code: ApiErrorCode.AUTH001,
          message: 'Authentication failed',
          category: ErrorCategory.Authentication,
          httpStatus: status,
          details: data
        };
        break;
      case 429:
        apiError = {
          code: ApiErrorCode.RATE001,
          message: 'Rate limit exceeded',
          category: ErrorCategory.System,
          httpStatus: status,
          details: {
            retryAfter: error.response.headers['retry-after']
          }
        };
        break;
      default:
        if (data?.error) {
          apiError = {
            ...data.error,
            httpStatus: status
          };
        }
    }
  } else if (error.request) {
    apiError = {
      code: ApiErrorCode.SYNC001,
      message: 'Network error occurred',
      category: ErrorCategory.Integration,
      httpStatus: 0,
      details: {
        request: error.request
      }
    };
  }

  // Log error for monitoring
  console.error('API Error:', {
    error: apiError,
    url: error.config?.url,
    method: error.config?.method,
    requestId: error.config?.headers['X-Request-ID']
  });

  return {
    success: false,
    data: null,
    error: apiError,
    metadata: {
      timestamp: new Date().toISOString(),
      requestId: error.config?.headers['X-Request-ID'] as string,
      traceId: error.config?.headers['X-Request-ID'] as string,
      serverTimestamp: new Date().toISOString()
    }
  };
};

// Create API client instance
const apiClient = createApiClient();

// Create circuit breaker-protected API methods
const protectedApiClient = {
  get: createCircuitBreaker(apiClient.get).fire.bind(null),
  post: createCircuitBreaker(apiClient.post).fire.bind(null),
  put: createCircuitBreaker(apiClient.put).fire.bind(null),
  delete: createCircuitBreaker(apiClient.delete).fire.bind(null)
};

export {
  protectedApiClient as apiClient,
  handleApiError
};