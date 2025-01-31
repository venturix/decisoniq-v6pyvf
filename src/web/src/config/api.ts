/**
 * API configuration module for the Customer Success AI Platform frontend
 * Implements enterprise-grade API communication with comprehensive security and performance features
 * @version 1.0.0
 * @axios ^1.6.0
 */

import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { v4 as uuid } from 'uuid'; // ^9.0.0
import { APP_CONFIG } from './constants';
import { AUTH_CONFIG } from './auth';

/**
 * Core API configuration interface with strict typing
 */
interface ApiConfig {
  readonly BASE_URL: string;
  readonly TIMEOUT: number;
  readonly RETRY_ATTEMPTS: number;
  readonly ENDPOINTS: {
    readonly [key: string]: string;
  };
  readonly HEADERS: {
    readonly [key: string]: string | (() => string);
  };
  readonly CACHE_CONFIG: {
    readonly ttl: number;
    readonly maxSize: number;
    readonly staleWhileRevalidate: boolean;
  };
  readonly ERROR_CODES: {
    readonly [key: string]: string;
  };
}

/**
 * Enhanced API configuration with comprehensive settings for security and performance
 */
export const API_CONFIG: ApiConfig = {
  BASE_URL: process.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1',
  TIMEOUT: APP_CONFIG.API_TIMEOUT,
  RETRY_ATTEMPTS: APP_CONFIG.API_RETRY_ATTEMPTS,
  
  ENDPOINTS: {
    AUTH: '/auth',
    CUSTOMERS: '/customers',
    PLAYBOOKS: '/playbooks',
    RISK: '/risk',
    METRICS: '/metrics',
    ML: '/ml',
    INTEGRATIONS: '/integrations',
  },
  
  HEADERS: {
    'Content-Type': 'application/json',
    'X-API-Version': '1.0',
    'X-Request-ID': () => uuid(),
    'X-Client-Version': process.env.VITE_APP_VERSION || '1.0.0',
  },
  
  CACHE_CONFIG: {
    ttl: 300, // 5 minutes
    maxSize: 100, // Maximum cache entries
    staleWhileRevalidate: true,
  },
  
  ERROR_CODES: {
    AUTH_ERROR: 'AUTH001',
    VALIDATION_ERROR: 'VAL001',
    RATE_LIMIT_ERROR: 'RATE001',
    SERVER_ERROR: 'SRV001',
    PREDICTION_ERROR: 'PRED001',
    SYNC_ERROR: 'SYNC001',
    PLAYBOOK_ERROR: 'PLAY001',
  },
} as const;

/**
 * Creates an enhanced API configuration with security and performance features
 * @returns {AxiosRequestConfig} Configured Axios instance
 */
export function createApiConfig(): AxiosRequestConfig {
  const config: AxiosRequestConfig = {
    baseURL: API_CONFIG.BASE_URL,
    timeout: API_CONFIG.TIMEOUT,
    headers: {
      ...Object.entries(API_CONFIG.HEADERS).reduce((acc, [key, value]) => ({
        ...acc,
        [key]: typeof value === 'function' ? value() : value,
      }), {}),
    },
    validateStatus: (status: number) => status >= 200 && status < 300,
  };

  return config;
}

/**
 * Configures request interceptor with authentication and security features
 */
axios.interceptors.request.use(
  (config) => {
    // Add authentication token if available
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add request timestamp for monitoring
    config.headers['X-Request-Time'] = Date.now().toString();

    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

/**
 * Configures response interceptor with error handling and monitoring
 */
axios.interceptors.response.use(
  (response: AxiosResponse) => {
    // Calculate and log response time
    const requestTime = parseInt(response.config.headers['X-Request-Time'] as string);
    const responseTime = Date.now() - requestTime;
    
    // Log performance metrics if response time exceeds threshold
    if (responseTime > 3000) {
      console.warn(`API response time exceeded threshold: ${responseTime}ms`);
    }

    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config;
    
    // Handle token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        // Attempt token refresh
        const refreshToken = localStorage.getItem('refresh_token');
        const response = await axios.post(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH}/refresh`, {
          refreshToken,
        });
        
        const { accessToken } = response.data;
        localStorage.setItem('auth_token', accessToken);
        
        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return axios(originalRequest);
      } catch (refreshError) {
        // Handle refresh failure
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    // Handle rate limiting
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(axios(originalRequest));
        }, (parseInt(retryAfter) || 30) * 1000);
      });
    }

    // Map error codes
    const errorCode = error.response?.data?.code || API_CONFIG.ERROR_CODES.SERVER_ERROR;
    error.name = errorCode;

    return Promise.reject(error);
  }
);

/**
 * Configure automatic request retry with exponential backoff
 */
axios.defaults.raxConfig = {
  retry: API_CONFIG.RETRY_ATTEMPTS,
  retryDelay: (retryCount: number) => Math.min(1000 * Math.pow(2, retryCount), 10000),
  statusCodesToRetry: [[408, 429, 500, 502, 503, 504]],
};

/**
 * Configure CORS settings for security
 */
axios.defaults.withCredentials = true;

export default {
  API_CONFIG,
  createApiConfig,
};