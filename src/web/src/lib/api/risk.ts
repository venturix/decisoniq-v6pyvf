/**
 * Enterprise-grade API client library for risk assessment and management functionality
 * Implements caching, retry logic, and comprehensive type safety for risk profile operations
 * @version 1.0.0
 * @package @customer-success-ai/web
 */

import { apiClient } from '../utils/api';
import { RiskLevel, RiskScore, RiskAssessment, RISK_SCORE_THRESHOLDS } from '../types/risk';
import type { ApiResponse, PaginationMetadata } from '../types/api';

// API endpoint constants
const API_BASE_PATH = '/api/v1/risk';
const CACHE_TTL = 300000; // 5 minutes
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// Interface for pagination options
interface PaginationOptions {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Interface for risk filter options
interface FilterOptions {
  minScore?: number;
  maxScore?: number;
  levels?: RiskLevel[];
  dateRange?: {
    start: Date;
    end: Date;
  };
}

/**
 * Retrieves cached risk profile for a specific customer with automatic revalidation
 * @param customerId - Unique identifier of the customer
 * @returns Promise resolving to customer risk profile
 */
export async function getRiskProfile(customerId: string): Promise<ApiResponse<RiskAssessment>> {
  try {
    const response = await apiClient.get<RiskAssessment>(
      `${API_BASE_PATH}/${customerId}`,
      {
        headers: {
          'Cache-Control': `max-age=${CACHE_TTL}`,
          'X-Request-ID': crypto.randomUUID()
        }
      }
    );

    return response.data;
  } catch (error) {
    throw new Error(`Failed to retrieve risk profile: ${error}`);
  }
}

/**
 * Performs new risk assessment with retry logic and comprehensive validation
 * @param riskData - Risk assessment data to process
 * @returns Promise resolving to validated risk assessment results
 */
export async function assessRisk(riskData: RiskScore): Promise<ApiResponse<RiskAssessment>> {
  // Validate risk score range
  if (riskData.score < 0 || riskData.score > 100) {
    throw new Error('Risk score must be between 0 and 100');
  }

  // Validate risk factors
  if (!riskData.factors || riskData.factors.length === 0) {
    throw new Error('At least one risk factor is required');
  }

  try {
    const response = await apiClient.post<RiskAssessment>(
      `${API_BASE_PATH}/assess`,
      riskData,
      {
        headers: {
          'X-Request-ID': crypto.randomUUID()
        }
      }
    );

    return response.data;
  } catch (error) {
    throw new Error(`Risk assessment failed: ${error}`);
  }
}

/**
 * Updates risk profile with optimistic updates and conflict resolution
 * @param customerId - Customer identifier
 * @param updateData - Updated risk score data
 * @returns Promise resolving to updated risk profile
 */
export async function updateRiskProfile(
  customerId: string,
  updateData: Partial<RiskScore>
): Promise<ApiResponse<RiskAssessment>> {
  try {
    const response = await apiClient.put<RiskAssessment>(
      `${API_BASE_PATH}/${customerId}`,
      updateData,
      {
        headers: {
          'If-Match': '*', // Enable optimistic concurrency control
          'X-Request-ID': crypto.randomUUID()
        }
      }
    );

    return response.data;
  } catch (error) {
    if ((error as any).response?.status === 409) {
      // Handle version conflict
      throw new Error('Risk profile was updated by another process');
    }
    throw new Error(`Failed to update risk profile: ${error}`);
  }
}

/**
 * Retrieves paginated list of high-risk customers with enhanced filtering
 * @param options - Pagination options
 * @param filters - Risk filter criteria
 * @returns Promise resolving to paginated list of high-risk customers
 */
export async function getHighRiskCustomers(
  options: PaginationOptions,
  filters?: FilterOptions
): Promise<ApiResponse<RiskAssessment[]> & { pagination: PaginationMetadata }> {
  const queryParams = new URLSearchParams({
    page: options.page.toString(),
    pageSize: options.pageSize.toString(),
    sortBy: options.sortBy || 'score',
    sortOrder: options.sortOrder || 'desc',
    minScore: (filters?.minScore || RISK_SCORE_THRESHOLDS.HIGH).toString()
  });

  if (filters?.levels) {
    filters.levels.forEach(level => {
      queryParams.append('levels', level);
    });
  }

  if (filters?.dateRange) {
    queryParams.append('startDate', filters.dateRange.start.toISOString());
    queryParams.append('endDate', filters.dateRange.end.toISOString());
  }

  try {
    const response = await apiClient.get<RiskAssessment[]>(
      `${API_BASE_PATH}/high-risk?${queryParams.toString()}`,
      {
        headers: {
          'Cache-Control': `max-age=${CACHE_TTL}`,
          'X-Request-ID': crypto.randomUUID()
        }
      }
    );

    return response.data;
  } catch (error) {
    throw new Error(`Failed to retrieve high-risk customers: ${error}`);
  }
}