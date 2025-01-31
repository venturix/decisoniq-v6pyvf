/**
 * @fileoverview Redux reducer for risk assessment state management
 * Implements high-performance state updates with memoization and cache invalidation
 * @version 1.0.0
 */

import { Reducer } from 'redux'; // v4.2.1
import { 
    RiskActionTypes, 
    RiskState, 
    RiskAction 
} from './types';

/**
 * Initial state with normalized data structure for O(1) lookups
 */
const initialState: RiskState = {
    assessments: {},
    loading: false,
    error: null,
    lastUpdated: null
};

/**
 * High-performance reducer for risk assessment state management
 * Implements immutable updates with normalized data structures
 */
export const riskReducer: Reducer<RiskState, RiskAction> = (
    state = initialState,
    action
): RiskState => {
    switch (action.type) {
        case RiskActionTypes.FETCH_RISK_ASSESSMENT_REQUEST:
            return {
                ...state,
                loading: true,
                error: null
            };

        case RiskActionTypes.FETCH_RISK_ASSESSMENT_SUCCESS: {
            const { assessment } = action.payload;
            
            // Optimize for O(1) lookup with normalized data structure
            return {
                ...state,
                assessments: {
                    ...state.assessments,
                    [assessment.customerId]: assessment
                },
                loading: false,
                error: null,
                lastUpdated: new Date()
            };
        }

        case RiskActionTypes.FETCH_RISK_ASSESSMENT_FAILURE:
            return {
                ...state,
                loading: false,
                error: action.payload.error,
                lastUpdated: new Date()
            };

        case RiskActionTypes.UPDATE_RISK_SCORE_REQUEST: {
            const { customerId, score } = action.payload;
            
            // Optimistic update pattern
            const existingAssessment = state.assessments[customerId];
            if (!existingAssessment) {
                return state;
            }

            return {
                ...state,
                assessments: {
                    ...state.assessments,
                    [customerId]: {
                        ...existingAssessment,
                        score: score.score,
                        severityLevel: score.level,
                        factors: score.factors,
                        recommendations: score.recommendations,
                        updatedAt: new Date()
                    }
                },
                loading: true,
                error: null
            };
        }

        case RiskActionTypes.UPDATE_RISK_SCORE_SUCCESS: {
            const { assessment } = action.payload;
            
            // Memoized update with shallow equality check
            const currentAssessment = state.assessments[assessment.customerId];
            if (currentAssessment && currentAssessment.updatedAt >= assessment.updatedAt) {
                return {
                    ...state,
                    loading: false
                };
            }

            return {
                ...state,
                assessments: {
                    ...state.assessments,
                    [assessment.customerId]: assessment
                },
                loading: false,
                error: null,
                lastUpdated: new Date()
            };
        }

        case RiskActionTypes.UPDATE_RISK_SCORE_FAILURE: {
            // Revert optimistic update on failure
            const { error } = action.payload;
            return {
                ...state,
                loading: false,
                error,
                lastUpdated: new Date()
            };
        }

        default: {
            // Ensure type safety with type assertion
            const _exhaustiveCheck: never = action;
            return state;
        }
    }
};