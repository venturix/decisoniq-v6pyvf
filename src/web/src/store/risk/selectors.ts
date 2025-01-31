/**
 * @fileoverview Redux selectors for risk assessment state management
 * Provides memoized selectors for efficient access to risk-related state
 * @version 1.0.0
 */

import { createSelector } from 'reselect'; // v4.1.8
import { RiskState } from './types';
import { RiskAssessment } from '../../types/risk';

/**
 * Type for the root state containing risk slice
 */
interface RootState {
  risk: RiskState;
}

/**
 * Base selector to access the risk state slice
 * @param state Root Redux state
 * @returns Typed risk state slice
 */
export const selectRiskState = (state: RootState): RiskState => state.risk;

/**
 * Memoized selector for risk loading state
 * Optimized for minimal recomputation
 */
export const selectRiskLoading = createSelector(
  [selectRiskState],
  (riskState: RiskState): boolean => riskState.loading
);

/**
 * Memoized selector for risk error state
 * Provides type-safe error message access
 */
export const selectRiskError = createSelector(
  [selectRiskState],
  (riskState: RiskState): string | null => riskState.error
);

/**
 * Memoized selector for retrieving a specific customer's risk assessment
 * Handles undefined cases for missing assessments
 * @param customerId Customer identifier for assessment lookup
 */
export const selectRiskAssessment = createSelector(
  [
    selectRiskState,
    (_state: RootState, customerId: string) => customerId
  ],
  (riskState: RiskState, customerId: string): RiskAssessment | undefined => 
    riskState.assessments[customerId]
);

/**
 * Memoized selector for retrieving a customer's risk score
 * Optimized for derived state computation
 * @param customerId Customer identifier for score lookup
 */
export const selectRiskScore = createSelector(
  [selectRiskAssessment],
  (assessment: RiskAssessment | undefined): number | undefined =>
    assessment?.score
);

/**
 * Memoized selector for retrieving immutable risk factors
 * Ensures consistent reference equality for array values
 * @param customerId Customer identifier for factors lookup
 */
export const selectRiskFactors = createSelector(
  [selectRiskAssessment],
  (assessment: RiskAssessment | undefined): readonly RiskFactor[] | undefined =>
    assessment?.factors
);

/**
 * Memoized selector for checking if a customer has a risk assessment
 * Useful for conditional rendering and data validation
 * @param customerId Customer identifier to check
 */
export const selectHasRiskAssessment = createSelector(
  [selectRiskAssessment],
  (assessment: RiskAssessment | undefined): boolean => 
    assessment !== undefined
);

/**
 * Memoized selector for retrieving the last updated timestamp
 * Provides type-safe access to update tracking
 */
export const selectLastUpdated = createSelector(
  [selectRiskState],
  (riskState: RiskState): Date | null => riskState.lastUpdated
);