/**
 * Redux action creators for risk assessment state management
 * Implements high-performance, resilient actions with caching and error handling
 * @version 1.0.0
 */

import { Dispatch } from 'redux'; // v4.2.1
import { ThunkAction } from 'redux-thunk'; // v2.4.2
import { memoize } from 'lodash'; // v4.17.21

import { RiskActionTypes } from './types';
import { RiskAssessment, RiskScore } from '../../types/risk';
import { getRiskProfile, updateRiskProfile } from '../../lib/api/risk';
import { storage, StorageKeys } from '../../utils/storage';
import { ApiResponse, ApiErrorCode } from '../../types/api';

// Cache configuration
const CACHE_TTL = 300000; // 5 minutes
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// State type for ThunkAction
type RiskState = any;

/**
 * Memoized risk profile fetcher with cache invalidation
 */
const memoizedGetRiskProfile = memoize(
  (customerId: string) => getRiskProfile(customerId),
  { maxAge: CACHE_TTL }
);

/**
 * Validates risk score input data
 * @param score - Risk score to validate
 * @returns boolean indicating validity
 */
const validateRiskScore = (score: RiskScore): boolean => {
  if (score.score < 0 || score.score > 100) return false;
  if (score.confidence < 0 || score.confidence > 1) return false;
  if (!Object.values(RiskScore).includes(score.level)) return false;
  return true;
};

/**
 * Fetches risk assessment for a customer with caching and retry logic
 * @param customerId - Customer identifier
 * @param forceRefresh - Force cache refresh flag
 */
export const fetchRiskAssessment = (
  customerId: string,
  forceRefresh = false
): ThunkAction<Promise<RiskAssessment>, RiskState, unknown, any> => {
  return async (dispatch: Dispatch) => {
    dispatch({
      type: RiskActionTypes.FETCH_RISK_ASSESSMENT_REQUEST,
      payload: { customerId }
    });

    let retryCount = 0;
    let lastError: Error | null = null;

    while (retryCount < MAX_RETRIES) {
      try {
        // Check cache first if not forcing refresh
        if (!forceRefresh) {
          const cachedAssessment = storage.getItem<RiskAssessment>(
            `risk_${customerId}` as StorageKeys,
            true
          );
          if (cachedAssessment) {
            dispatch({
              type: RiskActionTypes.FETCH_RISK_ASSESSMENT_SUCCESS,
              payload: { assessment: cachedAssessment }
            });
            return cachedAssessment;
          }
        }

        // Fetch fresh data
        const response = await (forceRefresh 
          ? getRiskProfile(customerId)
          : memoizedGetRiskProfile(customerId));

        // Cache successful response
        if (response.data) {
          storage.setItem(
            `risk_${customerId}` as StorageKeys,
            response.data,
            true
          );
        }

        dispatch({
          type: RiskActionTypes.FETCH_RISK_ASSESSMENT_SUCCESS,
          payload: { assessment: response.data }
        });

        return response.data;

      } catch (error) {
        lastError = error as Error;
        retryCount++;

        if (retryCount < MAX_RETRIES) {
          // Exponential backoff
          await new Promise(resolve => 
            setTimeout(resolve, RETRY_DELAY * Math.pow(2, retryCount - 1))
          );
        }
      }
    }

    // All retries failed
    dispatch({
      type: RiskActionTypes.FETCH_RISK_ASSESSMENT_FAILURE,
      payload: { 
        error: lastError?.message || 'Failed to fetch risk assessment'
      }
    });

    throw new Error(lastError?.message || 'Failed to fetch risk assessment');
  };
};

/**
 * Updates risk score with optimistic updates and rollback capability
 * @param customerId - Customer identifier
 * @param score - New risk score
 */
export const updateRiskScore = (
  customerId: string,
  score: RiskScore
): ThunkAction<Promise<RiskAssessment>, RiskState, unknown, any> => {
  return async (dispatch: Dispatch) => {
    // Validate input
    if (!validateRiskScore(score)) {
      throw new Error('Invalid risk score data');
    }

    // Store current state for potential rollback
    const previousAssessment = storage.getItem<RiskAssessment>(
      `risk_${customerId}` as StorageKeys,
      true
    );

    try {
      // Optimistic update
      dispatch({
        type: RiskActionTypes.UPDATE_RISK_SCORE_REQUEST,
        payload: { customerId, score }
      });

      const response = await updateRiskProfile(customerId, score);

      // Update cache with new data
      if (response.data) {
        storage.setItem(
          `risk_${customerId}` as StorageKeys,
          response.data,
          true
        );
        
        // Invalidate memoized getter
        memoizedGetRiskProfile.cache.delete(customerId);
      }

      dispatch({
        type: RiskActionTypes.UPDATE_RISK_SCORE_SUCCESS,
        payload: { assessment: response.data }
      });

      return response.data;

    } catch (error) {
      // Rollback on failure
      if (previousAssessment) {
        storage.setItem(
          `risk_${customerId}` as StorageKeys,
          previousAssessment,
          true
        );
      }

      dispatch({
        type: RiskActionTypes.UPDATE_RISK_SCORE_FAILURE,
        payload: { 
          error: (error as Error).message || 'Failed to update risk score'
        }
      });

      throw error;
    }
  };
};