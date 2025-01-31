/**
 * Redux action creators for customer state management
 * Implements enterprise-grade features including request deduplication,
 * caching, and comprehensive error handling
 * @version 1.0.0
 * @package @customer-success-ai/web
 */

import { Dispatch } from 'redux'; // ^4.2.0
import { ThunkAction } from 'redux-thunk'; // ^2.4.2
import { createSelector } from 'reselect'; // ^4.1.0
import { CustomerActionTypes } from './types';
import type { Customer, CustomerInteraction } from '../../types/customer';
import { CustomerAPI } from '../../lib/api/customer';
import { storage, StorageKeys } from '../../utils/storage';
import { PERFORMANCE_THRESHOLDS } from '../../config/constants';
import type { ApiResponse, ApiError } from '../../types/api';

// Constants for action creator configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_RETRY_ATTEMPTS = 3;
const DEBOUNCE_DELAY = 300;

// Request deduplication cache
const pendingRequests = new Map<string, Promise<any>>();

/**
 * Creates a cache key for request deduplication
 * @param action - Action type
 * @param params - Request parameters
 */
const createCacheKey = (action: string, params: Record<string, any>): string => {
  return `${action}_${JSON.stringify(params)}`;
};

/**
 * Fetches customer list with pagination, caching, and error handling
 * @param params - Pagination and filtering parameters
 * @returns Thunk action for customer fetch operation
 */
export const fetchCustomers = (
  params: {
    page: number;
    pageSize: number;
    sortBy?: string;
    filter?: string;
    forceRefresh?: boolean;
  }
): ThunkAction<Promise<void>, any, null, any> => {
  return async (dispatch: Dispatch) => {
    const cacheKey = createCacheKey('fetchCustomers', params);

    try {
      // Check for pending request
      if (pendingRequests.has(cacheKey)) {
        return pendingRequests.get(cacheKey);
      }

      dispatch({ type: CustomerActionTypes.FETCH_CUSTOMERS_REQUEST });

      // Check cache if not forcing refresh
      if (!params.forceRefresh) {
        const cached = storage.getItem<ApiResponse<Customer[]>>(StorageKeys.CUSTOMER_LIST);
        if (cached && Date.now() - cached.metadata.timestamp < CACHE_TTL) {
          dispatch({
            type: CustomerActionTypes.FETCH_CUSTOMERS_SUCCESS,
            payload: cached.data
          });
          return;
        }
      }

      // Create and track request promise
      const request = CustomerAPI.getCustomers(params);
      pendingRequests.set(cacheKey, request);

      const startTime = performance.now();
      const response = await request;

      // Performance monitoring
      const duration = performance.now() - startTime;
      if (duration > PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME) {
        console.warn(`Slow customer fetch: ${duration}ms`);
      }

      // Cache successful response
      storage.setItem(StorageKeys.CUSTOMER_LIST, response);

      dispatch({
        type: CustomerActionTypes.FETCH_CUSTOMERS_SUCCESS,
        payload: response.data
      });
    } catch (error) {
      dispatch({
        type: CustomerActionTypes.FETCH_CUSTOMERS_FAILURE,
        payload: (error as ApiError).message
      });
    } finally {
      pendingRequests.delete(cacheKey);
    }
  };
};

/**
 * Updates customer health score with optimistic updates and rollback support
 * @param customerId - Customer identifier
 * @param options - Update options
 * @returns Thunk action for health score update
 */
export const updateHealthScore = (
  customerId: string,
  options: { skipCache?: boolean; retryCount?: number } = {}
): ThunkAction<Promise<void>, any, null, any> => {
  return async (dispatch: Dispatch) => {
    const currentScore = storage.getItem<number>(`healthScore_${customerId}`);
    let retryAttempt = options.retryCount || 0;

    try {
      // Optimistic update
      if (currentScore) {
        dispatch({
          type: CustomerActionTypes.UPDATE_HEALTH_SCORE,
          payload: {
            customerId,
            healthScore: currentScore
          }
        });
      }

      const response = await CustomerAPI.getCustomerHealthScore(customerId, {
        realtime: !options.skipCache
      });

      // Update cache
      storage.setItem(`healthScore_${customerId}`, response, true);

      dispatch({
        type: CustomerActionTypes.UPDATE_HEALTH_SCORE,
        payload: {
          customerId,
          healthScore: response
        }
      });
    } catch (error) {
      // Rollback on failure
      if (currentScore) {
        dispatch({
          type: CustomerActionTypes.UPDATE_HEALTH_SCORE,
          payload: {
            customerId,
            healthScore: currentScore
          }
        });
      }

      // Retry logic
      if (retryAttempt < MAX_RETRY_ATTEMPTS) {
        setTimeout(() => {
          dispatch(updateHealthScore(customerId, {
            ...options,
            retryCount: retryAttempt + 1
          }));
        }, Math.pow(2, retryAttempt) * 1000);
      } else {
        throw error;
      }
    }
  };
};

/**
 * Adds new customer interaction with offline support
 * @param interaction - Customer interaction details
 * @returns Action for adding interaction
 */
export const addInteraction = (
  interaction: CustomerInteraction
): ThunkAction<Promise<void>, any, null, any> => {
  return async (dispatch: Dispatch) => {
    // Generate unique ID for interaction
    const interactionId = crypto.randomUUID();
    const enhancedInteraction = {
      ...interaction,
      id: interactionId,
      timestamp: new Date()
    };

    try {
      // Optimistic update
      dispatch({
        type: CustomerActionTypes.ADD_INTERACTION,
        payload: enhancedInteraction
      });

      // Store in offline queue if needed
      if (!navigator.onLine) {
        const offlineQueue = storage.getItem<CustomerInteraction[]>(StorageKeys.OFFLINE_INTERACTIONS) || [];
        storage.setItem(StorageKeys.OFFLINE_INTERACTIONS, [...offlineQueue, enhancedInteraction]);
        return;
      }

      await CustomerAPI.addCustomerInteraction(enhancedInteraction);
    } catch (error) {
      // Rollback and queue for retry
      const offlineQueue = storage.getItem<CustomerInteraction[]>(StorageKeys.OFFLINE_INTERACTIONS) || [];
      storage.setItem(StorageKeys.OFFLINE_INTERACTIONS, [...offlineQueue, enhancedInteraction]);

      console.error('Failed to add interaction:', error);
    }
  };
};

// Export action creators
export const customerActions = {
  fetchCustomers,
  updateHealthScore,
  addInteraction
};