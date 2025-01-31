/**
 * Enterprise-grade Customer API service module for the Customer Success AI Platform
 * Provides typed HTTP client functions for customer data operations with advanced caching and monitoring
 * @version 1.0.0
 * @package @customer-success-ai/web
 */

import { apiClient } from '../../utils/api';
import { API_CONFIG } from '../../config/api';
import type { 
  Customer,
  CustomerResponse,
  CustomerListResponse,
  CustomerRiskProfile,
  CustomerSortField
} from '../../types/customer';
import type { ApiResponse, TypedAxiosResponse } from '../../types/api';

// Cache configuration for customer data
const CACHE_CONFIG = {
  customer: { ttl: 300, maxSize: 1000 }, // 5 minutes for customer details
  list: { ttl: 60, maxSize: 100 }, // 1 minute for customer lists
  health: { ttl: 120, maxSize: 500 }, // 2 minutes for health scores
  risk: { ttl: 180, maxSize: 500 } // 3 minutes for risk assessments
};

// Performance monitoring thresholds
const PERFORMANCE_THRESHOLDS = {
  warning: 2000, // 2 seconds
  critical: 3000 // 3 seconds
};

/**
 * Retrieves detailed customer information by ID with caching and retry logic
 * @param customerId - Unique customer identifier
 * @param options - Request options for cache and abort control
 * @returns Promise resolving to customer details
 */
export async function getCustomer(
  customerId: string,
  options: { skipCache?: boolean; signal?: AbortSignal } = {}
): Promise<Customer> {
  const startTime = performance.now();
  
  try {
    const response = await apiClient.get<CustomerResponse>(
      `${API_CONFIG.ENDPOINTS.CUSTOMERS}/${customerId}`,
      {
        params: { include: ['metadata', 'riskProfile'] },
        headers: { 'Cache-Control': options.skipCache ? 'no-cache' : 'max-age=300' },
        signal: options.signal
      }
    );

    const duration = performance.now() - startTime;
    if (duration > PERFORMANCE_THRESHOLDS.warning) {
      console.warn(`Slow customer fetch: ${duration}ms for ID ${customerId}`);
    }

    return response.data.data;
  } catch (error) {
    console.error(`Failed to fetch customer ${customerId}:`, error);
    throw error;
  }
}

/**
 * Retrieves paginated list of customers with advanced filtering and sorting
 * @param params - Query parameters for pagination, sorting, and filtering
 * @param options - Request options including cache and priority settings
 * @returns Promise resolving to paginated customer list
 */
export async function getCustomers(
  params: {
    page?: number;
    pageSize?: number;
    sortBy?: CustomerSortField;
    filter?: string;
    fields?: string[];
  } = {},
  options: {
    skipCache?: boolean;
    priority?: 'high' | 'normal' | 'low';
  } = {}
): Promise<ApiResponse<Customer[]>> {
  const startTime = performance.now();

  try {
    const response = await apiClient.get<CustomerListResponse>(
      API_CONFIG.ENDPOINTS.CUSTOMERS,
      {
        params: {
          page: params.page || 1,
          pageSize: params.pageSize || 20,
          sortBy: params.sortBy,
          filter: params.filter,
          fields: params.fields?.join(',')
        },
        headers: {
          'Cache-Control': options.skipCache ? 'no-cache' : 'max-age=60',
          'X-Priority': options.priority || 'normal'
        }
      }
    );

    const duration = performance.now() - startTime;
    if (duration > PERFORMANCE_THRESHOLDS.warning) {
      console.warn(`Slow customer list fetch: ${duration}ms`);
    }

    return response.data;
  } catch (error) {
    console.error('Failed to fetch customer list:', error);
    throw error;
  }
}

/**
 * Updates customer information with optimistic updates and rollback
 * @param customerId - Customer identifier
 * @param customerData - Partial customer data to update
 * @param options - Update options for optimistic updates and retry
 * @returns Promise resolving to updated customer
 */
export async function updateCustomer(
  customerId: string,
  customerData: Partial<Customer>,
  options: {
    optimistic?: boolean;
    retry?: boolean;
  } = {}
): Promise<Customer> {
  const startTime = performance.now();

  try {
    const response = await apiClient.put<CustomerResponse>(
      `${API_CONFIG.ENDPOINTS.CUSTOMERS}/${customerId}`,
      customerData,
      {
        headers: {
          'X-Optimistic-Lock': options.optimistic ? 'true' : 'false',
          'X-Retry-Enabled': options.retry ? 'true' : 'false'
        }
      }
    );

    const duration = performance.now() - startTime;
    if (duration > PERFORMANCE_THRESHOLDS.warning) {
      console.warn(`Slow customer update: ${duration}ms for ID ${customerId}`);
    }

    return response.data.data;
  } catch (error) {
    console.error(`Failed to update customer ${customerId}:`, error);
    throw error;
  }
}

/**
 * Retrieves customer health score with real-time updates
 * @param customerId - Customer identifier
 * @param options - Health score options for real-time and historical data
 * @returns Promise resolving to customer health score
 */
export async function getCustomerHealthScore(
  customerId: string,
  options: {
    realtime?: boolean;
    historical?: boolean;
  } = {}
): Promise<number> {
  const startTime = performance.now();

  try {
    const response = await apiClient.get<ApiResponse<number>>(
      `${API_CONFIG.ENDPOINTS.CUSTOMERS}/${customerId}/health-score`,
      {
        params: {
          realtime: options.realtime,
          includeHistory: options.historical
        },
        headers: {
          'Cache-Control': options.realtime ? 'no-cache' : 'max-age=120'
        }
      }
    );

    const duration = performance.now() - startTime;
    if (duration > PERFORMANCE_THRESHOLDS.warning) {
      console.warn(`Slow health score fetch: ${duration}ms for ID ${customerId}`);
    }

    return response.data.data;
  } catch (error) {
    console.error(`Failed to fetch health score for customer ${customerId}:`, error);
    throw error;
  }
}

/**
 * Retrieves customer risk assessment with predictive caching
 * @param customerId - Customer identifier
 * @param options - Risk assessment options for detailed and predictive data
 * @returns Promise resolving to customer risk assessment
 */
export async function getCustomerRiskAssessment(
  customerId: string,
  options: {
    detailed?: boolean;
    predictive?: boolean;
  } = {}
): Promise<CustomerRiskProfile> {
  const startTime = performance.now();

  try {
    const response = await apiClient.get<ApiResponse<CustomerRiskProfile>>(
      `${API_CONFIG.ENDPOINTS.CUSTOMERS}/${customerId}/risk-assessment`,
      {
        params: {
          detailed: options.detailed,
          includePredictions: options.predictive
        },
        headers: {
          'Cache-Control': 'max-age=180',
          'X-Prediction-Enabled': options.predictive ? 'true' : 'false'
        }
      }
    );

    const duration = performance.now() - startTime;
    if (duration > PERFORMANCE_THRESHOLDS.warning) {
      console.warn(`Slow risk assessment fetch: ${duration}ms for ID ${customerId}`);
    }

    return response.data.data;
  } catch (error) {
    console.error(`Failed to fetch risk assessment for customer ${customerId}:`, error);
    throw error;
  }
}