/**
 * Core TypeScript type definitions for API interfaces, responses, and request types
 * @version 1.0.0
 * @package @customer-success-ai/web
 */

import type { AxiosResponse } from 'axios'; // ^1.6.0
import type { User } from './auth';
import type { Customer } from './customer';

/**
 * Standardized API error codes mapped to specific error scenarios
 */
export enum ApiErrorCode {
  AUTH001 = 'AUTH001', // Authentication failure
  DATA001 = 'DATA001', // Data validation error
  PRED001 = 'PRED001', // Prediction service unavailable
  SYNC001 = 'SYNC001', // Integration sync failure
  RATE001 = 'RATE001', // Rate limit exceeded
  PLAY001 = 'PLAY001', // Playbook execution error
  ML001 = 'ML001'      // Model inference error
}

/**
 * High-level error categories for grouping and handling related errors
 */
export enum ErrorCategory {
  Authentication = 'Authentication',
  Validation = 'Validation',
  Processing = 'Processing',
  Integration = 'Integration',
  System = 'System'
}

/**
 * Comprehensive error interface with detailed context and metadata
 */
export interface ApiError {
  readonly code: ApiErrorCode;
  readonly message: string;
  readonly details: Record<string, any>;
  readonly category: ErrorCategory;
  readonly httpStatus: number;
}

/**
 * Pagination metadata for list responses
 */
export interface PaginationMetadata {
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
  readonly totalItems: number;
}

/**
 * Extended API response metadata for debugging and tracking
 */
export interface ApiMetadata {
  readonly timestamp: string;
  readonly requestId: string;
  readonly traceId: string;
  readonly serverTimestamp: string;
  readonly pagination?: PaginationMetadata;
}

/**
 * Generic API response wrapper with type safety for response data
 */
export interface ApiResponse<T> {
  readonly data: T;
  readonly success: boolean;
  readonly error: ApiError | null;
  readonly metadata: ApiMetadata;
}

/**
 * Configuration options for API requests
 */
export interface ApiRequestConfig {
  params?: Record<string, any>;
  headers?: Record<string, string>;
  timeout?: number;
}

/**
 * Type alias for axios response with our API response structure
 */
export type TypedAxiosResponse<T> = AxiosResponse<ApiResponse<T>>;

/**
 * Common response types for frequently used entities
 */
export type UserResponse = ApiResponse<User>;
export type CustomerResponse = ApiResponse<Customer>;
export type CustomerListResponse = ApiResponse<Customer[]>;

/**
 * Error mapping interface for translating error codes to user messages
 */
export interface ErrorCodeMapping {
  readonly [key in ApiErrorCode]: {
    readonly message: string;
    readonly category: ErrorCategory;
    readonly defaultStatus: number;
  };
}

/**
 * Default error code mappings
 */
export const DEFAULT_ERROR_MAPPINGS: ErrorCodeMapping = {
  [ApiErrorCode.AUTH001]: {
    message: 'Authentication failed. Please log in again.',
    category: ErrorCategory.Authentication,
    defaultStatus: 401
  },
  [ApiErrorCode.DATA001]: {
    message: 'Invalid data provided. Please check your input.',
    category: ErrorCategory.Validation,
    defaultStatus: 400
  },
  [ApiErrorCode.PRED001]: {
    message: 'Prediction service is temporarily unavailable.',
    category: ErrorCategory.Processing,
    defaultStatus: 503
  },
  [ApiErrorCode.SYNC001]: {
    message: 'Integration synchronization failed.',
    category: ErrorCategory.Integration,
    defaultStatus: 502
  },
  [ApiErrorCode.RATE001]: {
    message: 'Rate limit exceeded. Please try again later.',
    category: ErrorCategory.System,
    defaultStatus: 429
  },
  [ApiErrorCode.PLAY001]: {
    message: 'Playbook execution failed.',
    category: ErrorCategory.Processing,
    defaultStatus: 500
  },
  [ApiErrorCode.ML001]: {
    message: 'Machine learning model inference failed.',
    category: ErrorCategory.Processing,
    defaultStatus: 503
  }
} as const;

/**
 * Type guard to check if a response is an error response
 */
export function isErrorResponse(response: ApiResponse<unknown>): response is ApiResponse<never> {
  return !response.success && response.error !== null;
}

/**
 * Type guard to check if a response has pagination
 */
export function hasPagination(metadata: ApiMetadata): metadata is Required<ApiMetadata> {
  return metadata.pagination !== undefined;
}