/**
 * Custom React hook for managing customer data and operations in the Customer Success AI Platform
 * @version 1.0.0
 * @package @customer-success-ai/web
 */

import { useCallback, useEffect, useRef } from 'react'; // ^18.0.0
import { useDispatch, useSelector } from 'react-redux'; // ^8.0.0
import { debounce } from 'lodash'; // ^4.17.21
import type { Customer } from '../../types/customer';
import type { ApiError, ApiErrorCode } from '../../types/api';

/**
 * Loading state type for tracking async operations
 */
type LoadingState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Interface for hook configuration options
 */
interface UseCustomerOptions {
  autoLoad?: boolean;
  refreshInterval?: number;
  cacheTimeout?: number;
  retryAttempts?: number;
}

/**
 * Interface for customer cache entry
 */
interface CustomerCacheEntry {
  data: Customer;
  timestamp: number;
}

/**
 * Default configuration values
 */
const DEFAULT_OPTIONS: Required<UseCustomerOptions> = {
  autoLoad: true,
  refreshInterval: 30000, // 30 seconds
  cacheTimeout: 300000,  // 5 minutes
  retryAttempts: 3
};

/**
 * Custom hook for managing customer data and operations
 */
export function useCustomer(options: UseCustomerOptions = {}) {
  const dispatch = useDispatch();
  const abortControllerRef = useRef<AbortController>();
  const cacheRef = useRef<Map<string, CustomerCacheEntry>>(new Map());
  const retryCountRef = useRef<number>(0);

  // Merge options with defaults
  const config = { ...DEFAULT_OPTIONS, ...options };

  // Redux selectors
  const customers = useSelector((state: any) => state.customers.list);
  const selectedCustomer = useSelector((state: any) => state.customers.selected);
  const healthScore = useSelector((state: any) => state.customers.healthScore);

  // Local state refs
  const loadingRef = useRef<LoadingState>('idle');
  const errorRef = useRef<ApiError | null>(null);

  /**
   * Debounced health score refresh function
   */
  const debouncedRefreshHealthScore = useCallback(
    debounce(async (customerId: string) => {
      try {
        const response = await dispatch({
          type: 'customers/refreshHealthScore',
          payload: { customerId }
        });
        
        if (response.error) throw response.error;
        
        // Update cache
        const customer = response.payload;
        cacheRef.current.set(customerId, {
          data: customer,
          timestamp: Date.now()
        });
      } catch (error) {
        errorRef.current = error as ApiError;
        loadingRef.current = 'error';
      }
    }, 500),
    [dispatch]
  );

  /**
   * Load customers with pagination and filtering support
   */
  const loadCustomers = useCallback(async (params?: {
    page?: number;
    pageSize?: number;
    sortBy?: string;
    filter?: string;
  }) => {
    try {
      loadingRef.current = 'loading';
      
      // Cancel previous request if exists
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      const response = await dispatch({
        type: 'customers/fetchCustomers',
        payload: {
          ...params,
          signal: abortControllerRef.current.signal
        }
      });

      if (response.error) throw response.error;
      
      loadingRef.current = 'success';
      retryCountRef.current = 0;
    } catch (error) {
      const apiError = error as ApiError;
      
      if (apiError.code === ApiErrorCode.RATE001 && retryCountRef.current < config.retryAttempts) {
        retryCountRef.current++;
        setTimeout(() => loadCustomers(params), 1000 * retryCountRef.current);
        return;
      }

      errorRef.current = apiError;
      loadingRef.current = 'error';
    }
  }, [dispatch, config.retryAttempts]);

  /**
   * Select customer by ID with optimistic updates
   */
  const selectCustomerById = useCallback(async (customerId: string) => {
    if (!customerId) return;

    try {
      loadingRef.current = 'loading';

      // Check cache first
      const cached = cacheRef.current.get(customerId);
      if (cached && Date.now() - cached.timestamp < config.cacheTimeout) {
        dispatch({
          type: 'customers/selectCustomer',
          payload: cached.data
        });
        loadingRef.current = 'success';
        return;
      }

      const response = await dispatch({
        type: 'customers/selectCustomer',
        payload: { customerId }
      });

      if (response.error) throw response.error;

      // Update cache
      cacheRef.current.set(customerId, {
        data: response.payload,
        timestamp: Date.now()
      });

      loadingRef.current = 'success';
      await debouncedRefreshHealthScore(customerId);
    } catch (error) {
      errorRef.current = error as ApiError;
      loadingRef.current = 'error';
    }
  }, [dispatch, config.cacheTimeout, debouncedRefreshHealthScore]);

  /**
   * Refresh customer health score
   */
  const refreshHealthScore = useCallback(async (customerId: string) => {
    if (!customerId) return;
    await debouncedRefreshHealthScore(customerId);
  }, [debouncedRefreshHealthScore]);

  /**
   * Clear current error state
   */
  const clearError = useCallback(() => {
    errorRef.current = null;
    loadingRef.current = 'idle';
  }, []);

  // Setup auto-load effect
  useEffect(() => {
    if (config.autoLoad) {
      loadCustomers();
    }
  }, [config.autoLoad, loadCustomers]);

  // Setup refresh interval effect
  useEffect(() => {
    if (!config.refreshInterval || !selectedCustomer) return;

    const intervalId = setInterval(() => {
      refreshHealthScore(selectedCustomer.id);
    }, config.refreshInterval);

    return () => clearInterval(intervalId);
  }, [config.refreshInterval, selectedCustomer, refreshHealthScore]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      debouncedRefreshHealthScore.cancel();
    };
  }, [debouncedRefreshHealthScore]);

  return {
    customers,
    selectedCustomer,
    healthScore,
    loadingState: loadingRef.current,
    error: errorRef.current,
    loadCustomers,
    selectCustomerById,
    refreshHealthScore,
    clearError
  };
}