/**
 * Enhanced API client utility for testing HTTP endpoints of the Customer Success AI Platform
 * Provides comprehensive testing capabilities with security, performance monitoring, and resilient error handling
 * @version 1.0.0
 * @package @customer-success-ai/test
 */

// External imports
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'; // v1.6.x

// Internal imports
import { TestEnvironment } from '../types/test';
import { EnvironmentConfig, getEnvironmentConfig } from '../config/test-environment';

/**
 * Configuration interface for API client with enhanced security and performance options
 */
interface ApiClientConfig {
  environment: TestEnvironment;
  baseURL: string;
  timeout: number;
  headers: Record<string, string>;
  enableRetry: boolean;
  maxRetries: number;
  enableMetrics: boolean;
  enableCircuitBreaker: boolean;
}

/**
 * Enhanced generic API response interface with detailed error handling
 */
interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
  statusCode: number;
  requestId: string;
  responseTime: number;
}

/**
 * Circuit breaker state management
 */
class CircuitBreaker {
  private failures: number = 0;
  private lastFailure: number = 0;
  private readonly threshold: number = 5;
  private readonly resetTimeout: number = 30000; // 30 seconds

  public isOpen(): boolean {
    if (this.failures >= this.threshold) {
      const now = Date.now();
      if (now - this.lastFailure >= this.resetTimeout) {
        this.reset();
        return false;
      }
      return true;
    }
    return false;
  }

  public recordFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();
  }

  public recordSuccess(): void {
    this.reset();
  }

  private reset(): void {
    this.failures = 0;
    this.lastFailure = 0;
  }
}

/**
 * Metrics collection for performance monitoring
 */
class MetricsCollector {
  private metrics: Map<string, number[]> = new Map();

  public recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)?.push(value);
  }

  public getMetrics(): Record<string, { avg: number; p95: number; max: number }> {
    const result: Record<string, { avg: number; p95: number; max: number }> = {};
    
    this.metrics.forEach((values, name) => {
      const sorted = [...values].sort((a, b) => a - b);
      const sum = sorted.reduce((a, b) => a + b, 0);
      const p95Index = Math.floor(sorted.length * 0.95);
      
      result[name] = {
        avg: sum / sorted.length,
        p95: sorted[p95Index],
        max: sorted[sorted.length - 1]
      };
    });

    return result;
  }
}

/**
 * Enhanced API client class for comprehensive platform testing
 */
export class ApiClient {
  private client: AxiosInstance;
  private readonly config: ApiClientConfig;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly metricsCollector: MetricsCollector;

  constructor(environment: TestEnvironment, config?: Partial<ApiClientConfig>) {
    const envConfig: EnvironmentConfig = getEnvironmentConfig(environment);

    this.config = {
      environment,
      baseURL: envConfig.apiUrl,
      timeout: envConfig.timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-Test-Environment': environment,
        'X-Client-Version': '1.0.0'
      },
      enableRetry: true,
      maxRetries: 3,
      enableMetrics: true,
      enableCircuitBreaker: true,
      ...config
    };

    this.circuitBreaker = new CircuitBreaker();
    this.metricsCollector = new MetricsCollector();

    this.client = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: this.config.headers
    });

    this.setupInterceptors();
  }

  /**
   * Sets JWT authentication token with enhanced security
   */
  public setAuthToken(token: string): void {
    if (!token || typeof token !== 'string') {
      throw new Error('Invalid authentication token');
    }
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  /**
   * Makes GET request with enhanced error handling and monitoring
   */
  public async get<T>(url: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    return this.request<T>('GET', url, { params });
  }

  /**
   * Makes POST request with enhanced error handling and monitoring
   */
  public async post<T>(url: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>('POST', url, { data });
  }

  /**
   * Makes PUT request with enhanced error handling and monitoring
   */
  public async put<T>(url: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', url, { data });
  }

  /**
   * Makes DELETE request with enhanced error handling and monitoring
   */
  public async delete<T>(url: string): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', url);
  }

  /**
   * Handles file upload with progress tracking
   */
  public async uploadFile<T>(url: string, file: File, onProgress?: (progress: number) => void): Promise<ApiResponse<T>> {
    const formData = new FormData();
    formData.append('file', file);

    return this.request<T>('POST', url, {
      data: formData,
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = (progressEvent.loaded * 100) / progressEvent.total;
          onProgress(progress);
        }
      }
    });
  }

  /**
   * Handles file download with progress tracking
   */
  public async downloadFile(url: string, onProgress?: (progress: number) => void): Promise<Blob> {
    const response = await this.client.get(url, {
      responseType: 'blob',
      onDownloadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = (progressEvent.loaded * 100) / progressEvent.total;
          onProgress(progress);
        }
      }
    });
    return response.data;
  }

  /**
   * Retrieves collected performance metrics
   */
  public getMetrics(): Record<string, { avg: number; p95: number; max: number }> {
    return this.metricsCollector.getMetrics();
  }

  private async request<T>(
    method: string,
    url: string,
    config: AxiosRequestConfig = {}
  ): Promise<ApiResponse<T>> {
    if (this.config.enableCircuitBreaker && this.circuitBreaker.isOpen()) {
      throw new Error('Circuit breaker is open - too many recent failures');
    }

    const startTime = Date.now();
    let attempt = 0;

    while (attempt < (this.config.enableRetry ? this.config.maxRetries : 1)) {
      try {
        const response = await this.client.request<T>({
          method,
          url,
          ...config
        });

        const responseTime = Date.now() - startTime;
        if (this.config.enableMetrics) {
          this.metricsCollector.recordMetric(`${method}_${url}`, responseTime);
        }

        this.circuitBreaker.recordSuccess();

        return {
          success: true,
          data: response.data,
          error: null,
          statusCode: response.status,
          requestId: response.headers['x-request-id'] || '',
          responseTime
        };
      } catch (error: any) {
        attempt++;
        
        if (attempt === this.config.maxRetries || !this.config.enableRetry) {
          this.circuitBreaker.recordFailure();
          
          return {
            success: false,
            data: {} as T,
            error: error.message,
            statusCode: error.response?.status || 500,
            requestId: error.response?.headers?.['x-request-id'] || '',
            responseTime: Date.now() - startTime
          };
        }

        // Exponential backoff for retries
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
      }
    }

    throw new Error('Request failed after maximum retries');
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        config.headers['X-Request-ID'] = this.generateRequestId();
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        return response;
      },
      (error) => {
        if (error.response?.status === 401) {
          // Handle authentication errors
          this.handleAuthError();
        }
        return Promise.reject(error);
      }
    );
  }

  private generateRequestId(): string {
    return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private handleAuthError(): void {
    // Clear invalid token
    delete this.client.defaults.headers.common['Authorization'];
  }
}