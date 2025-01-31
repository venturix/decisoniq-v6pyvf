/**
 * API client library for managing playbook operations in the Customer Success AI Platform
 * Implements enterprise-grade error handling, caching, and performance optimizations
 * @version 1.0.0
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'; // ^1.6.0
import axiosRetry from 'axios-retry'; // ^3.8.0
import createError from 'http-errors'; // ^2.0.0
import NodeCache from 'node-cache'; // ^5.1.2
import { API_CONFIG } from '../../config/api';

/**
 * Interface for playbook creation request with strict validation
 */
interface PlaybookCreateRequest {
  name: string;
  description: string;
  steps: PlaybookStep[];
  triggers: PlaybookTrigger[];
  isActive: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Interface for playbook step configuration
 */
interface PlaybookStep {
  id: string;
  type: 'email' | 'task' | 'notification' | 'integration';
  action: string;
  parameters: Record<string, unknown>;
  conditions?: PlaybookCondition[];
  timeout?: number;
}

/**
 * Interface for playbook trigger configuration
 */
interface PlaybookTrigger {
  type: 'risk_score' | 'usage_decline' | 'support_ticket' | 'custom';
  conditions: PlaybookCondition[];
  priority: 'high' | 'medium' | 'low';
}

/**
 * Interface for playbook condition configuration
 */
interface PlaybookCondition {
  field: string;
  operator: 'eq' | 'gt' | 'lt' | 'contains' | 'between';
  value: unknown;
}

/**
 * Interface for playbook response data
 */
interface Playbook extends PlaybookCreateRequest {
  id: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  executionCount: number;
  successRate: number;
  lastExecutedAt?: string;
}

/**
 * Custom error class for playbook-related errors
 */
class PlaybookError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'PlaybookError';
  }
}

/**
 * Decorator for request validation
 */
function validateRequest(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = async function(...args: any[]) {
    if (!args[0] || typeof args[0] !== 'object') {
      throw new PlaybookError(
        'Invalid request data',
        400,
        API_CONFIG.ERROR_CODES.VALIDATION_ERROR
      );
    }
    return originalMethod.apply(this, args);
  };
  return descriptor;
}

/**
 * Decorator for response caching
 */
function cacheResponse(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = async function(...args: any[]) {
    const cacheKey = `${propertyKey}-${JSON.stringify(args)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const result = await originalMethod.apply(this, args);
    this.cache.set(cacheKey, result, API_CONFIG.CACHE_CONFIG.ttl);
    return result;
  };
  return descriptor;
}

/**
 * PlaybookApiClient class for managing playbook operations
 * Implements enterprise-grade error handling and performance optimizations
 */
export class PlaybookApiClient {
  private httpClient: AxiosInstance;
  private cache: NodeCache;

  constructor(config?: AxiosRequestConfig) {
    // Initialize HTTP client with retry mechanism
    this.httpClient = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: API_CONFIG.TIMEOUT,
      ...config,
    });

    // Configure retry mechanism
    axiosRetry(this.httpClient, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          error.response?.status === 429;
      },
    });

    // Initialize cache
    this.cache = new NodeCache({
      stdTTL: API_CONFIG.CACHE_CONFIG.ttl,
      checkperiod: 120,
      maxKeys: API_CONFIG.CACHE_CONFIG.maxSize,
    });

    // Configure request interceptors
    this.httpClient.interceptors.request.use(
      (config) => {
        config.headers['X-Request-ID'] = crypto.randomUUID();
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Configure response interceptors
    this.httpClient.interceptors.response.use(
      (response) => response,
      (error) => this.handleError(error)
    );
  }

  /**
   * Creates a new playbook with validation and error handling
   * @param data PlaybookCreateRequest
   * @returns Promise<Playbook>
   */
  @validateRequest
  public async createPlaybook(data: PlaybookCreateRequest): Promise<Playbook> {
    try {
      const response = await this.httpClient.post<Playbook>(
        API_CONFIG.ENDPOINTS.PLAYBOOKS,
        data
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Retrieves a playbook by ID with caching
   * @param playbookId string
   * @returns Promise<Playbook>
   */
  @cacheResponse
  public async getPlaybook(playbookId: string): Promise<Playbook> {
    try {
      const response = await this.httpClient.get<Playbook>(
        `${API_CONFIG.ENDPOINTS.PLAYBOOKS}/${playbookId}`
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Updates an existing playbook
   * @param playbookId string
   * @param data Partial<PlaybookCreateRequest>
   * @returns Promise<Playbook>
   */
  @validateRequest
  public async updatePlaybook(
    playbookId: string,
    data: Partial<PlaybookCreateRequest>
  ): Promise<Playbook> {
    try {
      const response = await this.httpClient.put<Playbook>(
        `${API_CONFIG.ENDPOINTS.PLAYBOOKS}/${playbookId}`,
        data
      );
      this.cache.del(`getPlaybook-["${playbookId}"]`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Deletes a playbook by ID
   * @param playbookId string
   * @returns Promise<void>
   */
  public async deletePlaybook(playbookId: string): Promise<void> {
    try {
      await this.httpClient.delete(
        `${API_CONFIG.ENDPOINTS.PLAYBOOKS}/${playbookId}`
      );
      this.cache.del(`getPlaybook-["${playbookId}"]`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Lists all playbooks with pagination and filtering
   * @param params PlaybookListParams
   * @returns Promise<PlaybookListResponse>
   */
  @cacheResponse
  public async listPlaybooks(params?: {
    page?: number;
    limit?: number;
    status?: 'active' | 'inactive';
    search?: string;
  }): Promise<{
    data: Playbook[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const response = await this.httpClient.get(API_CONFIG.ENDPOINTS.PLAYBOOKS, {
        params,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Executes a playbook for a specific customer
   * @param playbookId string
   * @param customerId string
   * @returns Promise<void>
   */
  public async executePlaybook(
    playbookId: string,
    customerId: string
  ): Promise<void> {
    try {
      await this.httpClient.post(
        `${API_CONFIG.ENDPOINTS.PLAYBOOKS}/${playbookId}/execute`,
        { customerId }
      );
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Handles and transforms API errors
   * @param error any
   * @returns PlaybookError
   */
  private handleError(error: any): PlaybookError {
    const statusCode = error.response?.status || 500;
    const code = error.response?.data?.code || API_CONFIG.ERROR_CODES.PLAYBOOK_ERROR;
    const message = error.response?.data?.message || 'An error occurred while processing the playbook operation';
    const details = error.response?.data?.details;

    return new PlaybookError(message, statusCode, code, details);
  }
}

// Export singleton instance
export const playbookApi = new PlaybookApiClient();

// Export type definitions
export type {
  Playbook,
  PlaybookCreateRequest,
  PlaybookStep,
  PlaybookTrigger,
  PlaybookCondition,
};