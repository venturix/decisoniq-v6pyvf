/**
 * Enterprise-grade React hook for managing risk assessment functionality
 * Provides optimized state management, caching, and real-time updates
 * @version 1.0.0
 */

import { useCallback, useEffect, useRef } from 'react'; // v18.0.0
import { useDispatch, useSelector } from 'react-redux'; // v8.1.0

import { RiskLevel, RiskAssessment } from '../types/risk';
import { 
  fetchRiskAssessment,
  updateRiskScore
} from '../store/risk/actions';
import {
  selectRiskAssessment,
  selectRiskLoading,
  selectRiskError
} from '../store/risk/selectors';
import { storage, StorageKeys } from '../utils/storage';
import { PERFORMANCE_THRESHOLDS } from '../config/constants';

// Constants for risk assessment management
const STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes
const REFRESH_INTERVAL = 30 * 1000; // 30 seconds for real-time updates
const DEBOUNCE_DELAY = 300; // 300ms for debouncing updates

/**
 * Interface for hook configuration options
 */
interface UseRiskOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  enableWebSocket?: boolean;
  cacheResults?: boolean;
}

/**
 * Interface for WebSocket risk update message
 */
interface RiskUpdateMessage {
  customerId: string;
  assessment: RiskAssessment;
  timestamp: number;
}

/**
 * Enterprise-grade hook for managing customer risk assessments
 * @param customerId - Customer identifier
 * @param options - Configuration options
 */
export function useRisk(
  customerId: string,
  options: UseRiskOptions = {}
) {
  const {
    autoRefresh = true,
    refreshInterval = REFRESH_INTERVAL,
    enableWebSocket = true,
    cacheResults = true
  } = options;

  // Redux hooks
  const dispatch = useDispatch();
  const assessment = useSelector(state => selectRiskAssessment(state, customerId));
  const loading = useSelector(selectRiskLoading);
  const error = useSelector(selectRiskError);

  // Refs for managing side effects
  const wsRef = useRef<WebSocket | null>(null);
  const lastFetchRef = useRef<number>(0);
  const refreshTimerRef = useRef<number>();
  const pendingRequestRef = useRef<Promise<void> | null>(null);

  /**
   * Fetches risk assessment with deduplication and caching
   */
  const fetchAssessment = useCallback(async () => {
    // Prevent duplicate requests
    if (pendingRequestRef.current) {
      return pendingRequestRef.current;
    }

    try {
      pendingRequestRef.current = dispatch(fetchRiskAssessment(customerId));
      await pendingRequestRef.current;
      lastFetchRef.current = Date.now();

      // Cache successful results
      if (cacheResults && assessment) {
        storage.setItem(
          `risk_${customerId}` as StorageKeys,
          assessment,
          true
        );
      }
    } catch (error) {
      console.error('Risk assessment fetch failed:', error);
    } finally {
      pendingRequestRef.current = null;
    }
  }, [customerId, dispatch, cacheResults, assessment]);

  /**
   * Updates risk score with optimistic updates
   */
  const updateScore = useCallback(async (
    score: number
  ) => {
    if (score < 0 || score > 100) {
      throw new Error('Risk score must be between 0 and 100');
    }

    try {
      await dispatch(updateRiskScore(customerId, score));
      lastFetchRef.current = Date.now();
    } catch (error) {
      console.error('Risk score update failed:', error);
      throw error;
    }
  }, [customerId, dispatch]);

  /**
   * Checks if current assessment data is stale
   */
  const isStale = useCallback((): boolean => {
    if (!lastFetchRef.current) return true;
    return Date.now() - lastFetchRef.current > STALE_THRESHOLD;
  }, []);

  /**
   * Forces a refresh of risk assessment data
   */
  const refresh = useCallback(async () => {
    await fetchAssessment();
  }, [fetchAssessment]);

  /**
   * Sets up WebSocket connection for real-time updates
   */
  useEffect(() => {
    if (!enableWebSocket) return;

    const wsUrl = `${process.env.VITE_WS_URL}/risk`;
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onmessage = (event: MessageEvent) => {
      const update: RiskUpdateMessage = JSON.parse(event.data);
      if (update.customerId === customerId) {
        dispatch(fetchRiskAssessment(customerId, true));
      }
    };

    wsRef.current.onerror = (error) => {
      console.error('Risk WebSocket error:', error);
    };

    return () => {
      wsRef.current?.close();
    };
  }, [customerId, dispatch, enableWebSocket]);

  /**
   * Sets up automatic refresh interval
   */
  useEffect(() => {
    if (!autoRefresh) return;

    const startRefreshTimer = () => {
      refreshTimerRef.current = window.setInterval(() => {
        if (isStale()) {
          refresh();
        }
      }, refreshInterval);
    };

    startRefreshTimer();

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [autoRefresh, refreshInterval, isStale, refresh]);

  /**
   * Initial data fetch
   */
  useEffect(() => {
    if (!customerId) return;

    // Check cache first
    if (cacheResults) {
      const cached = storage.getItem<RiskAssessment>(
        `risk_${customerId}` as StorageKeys,
        true
      );
      if (cached && Date.now() - new Date(cached.updatedAt).getTime() < STALE_THRESHOLD) {
        return;
      }
    }

    fetchAssessment();
  }, [customerId, cacheResults, fetchAssessment]);

  return {
    assessment,
    loading,
    error,
    fetchAssessment,
    updateScore,
    isStale,
    refresh
  };
}