/**
 * Customer Redux State Management Types
 * @version 1.0.0
 * @package @customer-success-ai/web
 */

import { Action } from 'redux'; // ^4.2.0
import { Customer } from '../../types/customer';

/**
 * Comprehensive Redux action types for customer state management
 */
export enum CustomerActionTypes {
  FETCH_CUSTOMERS_REQUEST = '@customer/FETCH_CUSTOMERS_REQUEST',
  FETCH_CUSTOMERS_SUCCESS = '@customer/FETCH_CUSTOMERS_SUCCESS',
  FETCH_CUSTOMERS_FAILURE = '@customer/FETCH_CUSTOMERS_FAILURE',
  SELECT_CUSTOMER = '@customer/SELECT_CUSTOMER',
  UPDATE_HEALTH_SCORE = '@customer/UPDATE_HEALTH_SCORE',
  ADD_INTERACTION = '@customer/ADD_INTERACTION',
  UPDATE_RISK_SCORE = '@customer/UPDATE_RISK_SCORE',
  UPDATE_REVENUE_DATA = '@customer/UPDATE_REVENUE_DATA'
}

/**
 * Interface for detailed customer health score tracking
 */
export interface CustomerHealthScore {
  readonly score: number;
  readonly lastUpdated: Date;
  readonly factors: Record<string, number>;
  readonly trend: number;
  readonly threshold: number;
}

/**
 * Interface for tracking customer interactions
 */
export interface CustomerInteraction {
  readonly id: string;
  readonly customerId: string;
  readonly type: string;
  readonly description: string;
  readonly timestamp: Date;
  readonly owner: string;
  readonly outcome: string;
  readonly nextSteps: string[];
}

/**
 * Interface for customer risk assessment data
 */
export interface CustomerRiskAssessment {
  readonly score: number;
  readonly factors: Record<string, number>;
  readonly predictions: Record<string, number>;
  readonly lastUpdated: Date;
  readonly confidence: number;
}

/**
 * Interface for customer revenue tracking
 */
export interface CustomerRevenue {
  readonly mrr: number;
  readonly growth: number;
  readonly expansionOpportunities: Record<string, number>;
  readonly lastUpdated: Date;
}

/**
 * Comprehensive customer state interface with immutable properties
 */
export interface CustomerState {
  readonly customers: Customer[];
  readonly selectedCustomer: Customer | null;
  readonly healthScores: Record<string, CustomerHealthScore>;
  readonly interactions: CustomerInteraction[];
  readonly riskAssessments: Record<string, CustomerRiskAssessment>;
  readonly revenueData: Record<string, CustomerRevenue>;
  readonly loading: boolean;
  readonly error: string | null;
}

/**
 * Action interfaces for type-safe dispatch
 */
export interface FetchCustomersRequestAction extends Action<CustomerActionTypes.FETCH_CUSTOMERS_REQUEST> {}

export interface FetchCustomersSuccessAction extends Action<CustomerActionTypes.FETCH_CUSTOMERS_SUCCESS> {
  payload: Customer[];
}

export interface FetchCustomersFailureAction extends Action<CustomerActionTypes.FETCH_CUSTOMERS_FAILURE> {
  payload: string;
}

export interface SelectCustomerAction extends Action<CustomerActionTypes.SELECT_CUSTOMER> {
  payload: Customer;
}

export interface UpdateHealthScoreAction extends Action<CustomerActionTypes.UPDATE_HEALTH_SCORE> {
  payload: {
    customerId: string;
    healthScore: CustomerHealthScore;
  };
}

export interface AddInteractionAction extends Action<CustomerActionTypes.ADD_INTERACTION> {
  payload: CustomerInteraction;
}

export interface UpdateRiskScoreAction extends Action<CustomerActionTypes.UPDATE_RISK_SCORE> {
  payload: {
    customerId: string;
    riskAssessment: CustomerRiskAssessment;
  };
}

export interface UpdateRevenueDataAction extends Action<CustomerActionTypes.UPDATE_REVENUE_DATA> {
  payload: {
    customerId: string;
    revenueData: CustomerRevenue;
  };
}

/**
 * Union type for all possible customer action payloads
 */
export type CustomerActionPayload =
  | FetchCustomersRequestAction
  | FetchCustomersSuccessAction
  | FetchCustomersFailureAction
  | SelectCustomerAction
  | UpdateHealthScoreAction
  | AddInteractionAction
  | UpdateRiskScoreAction
  | UpdateRevenueDataAction;

/**
 * Type guard for checking if an action is a customer action
 */
export function isCustomerAction(action: Action): action is CustomerActionPayload {
  return action.type.startsWith('@customer/');
}