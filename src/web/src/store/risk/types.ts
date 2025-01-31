/**
 * @fileoverview Redux state management type definitions for risk assessment functionality
 * Provides type-safe action types and state interfaces for risk assessment operations
 * @version 1.0.0
 */

import { Action } from 'redux'; // v4.2.1
import { RiskAssessment, RiskScore } from '../../types/risk';

/**
 * Enumeration of all possible risk-related Redux action types
 */
export enum RiskActionTypes {
    FETCH_RISK_ASSESSMENT_REQUEST = '@risk/FETCH_RISK_ASSESSMENT_REQUEST',
    FETCH_RISK_ASSESSMENT_SUCCESS = '@risk/FETCH_RISK_ASSESSMENT_SUCCESS',
    FETCH_RISK_ASSESSMENT_FAILURE = '@risk/FETCH_RISK_ASSESSMENT_FAILURE',
    UPDATE_RISK_SCORE_REQUEST = '@risk/UPDATE_RISK_SCORE_REQUEST',
    UPDATE_RISK_SCORE_SUCCESS = '@risk/UPDATE_RISK_SCORE_SUCCESS',
    UPDATE_RISK_SCORE_FAILURE = '@risk/UPDATE_RISK_SCORE_FAILURE'
}

/**
 * Interface defining the shape of the risk state in Redux store
 */
export interface RiskState {
    readonly assessments: Record<string, RiskAssessment>; // Keyed by customerId
    readonly loading: boolean;
    readonly error: string | null;
    readonly lastUpdated: Date | null;
}

/**
 * Action interfaces for fetching risk assessments
 */
export interface FetchRiskAssessmentRequestAction extends Action {
    type: RiskActionTypes.FETCH_RISK_ASSESSMENT_REQUEST;
    payload: {
        customerId: string;
    };
}

export interface FetchRiskAssessmentSuccessAction extends Action {
    type: RiskActionTypes.FETCH_RISK_ASSESSMENT_SUCCESS;
    payload: {
        assessment: RiskAssessment;
    };
}

export interface FetchRiskAssessmentFailureAction extends Action {
    type: RiskActionTypes.FETCH_RISK_ASSESSMENT_FAILURE;
    payload: {
        error: string;
    };
}

/**
 * Action interfaces for updating risk scores
 */
export interface UpdateRiskScoreRequestAction extends Action {
    type: RiskActionTypes.UPDATE_RISK_SCORE_REQUEST;
    payload: {
        customerId: string;
        score: RiskScore;
    };
}

export interface UpdateRiskScoreSuccessAction extends Action {
    type: RiskActionTypes.UPDATE_RISK_SCORE_SUCCESS;
    payload: {
        assessment: RiskAssessment;
    };
}

export interface UpdateRiskScoreFailureAction extends Action {
    type: RiskActionTypes.UPDATE_RISK_SCORE_FAILURE;
    payload: {
        error: string;
    };
}

/**
 * Union type of all possible risk-related actions
 * Used for exhaustive type checking in reducers
 */
export type RiskAction =
    | FetchRiskAssessmentRequestAction
    | FetchRiskAssessmentSuccessAction
    | FetchRiskAssessmentFailureAction
    | UpdateRiskScoreRequestAction
    | UpdateRiskScoreSuccessAction
    | UpdateRiskScoreFailureAction;