/**
 * Customer Redux Reducer
 * @version 1.0.0
 * @package @customer-success-ai/web
 */

import { Reducer } from 'redux'; // ^4.2.0
import {
  CustomerState,
  CustomerAction,
  CustomerActionTypes,
  CustomerHealthScore,
  CustomerRiskAssessment,
  CustomerRevenue,
  CustomerInteraction
} from './types';

/**
 * Initial state with readonly constraints for customer management
 */
const initialState: CustomerState = {
  customers: [],
  selectedCustomer: null,
  healthScores: {},
  riskAssessments: {},
  revenueData: {},
  interactions: [],
  loading: false,
  error: null
} as const;

/**
 * Customer reducer handling all customer-related state updates with strict immutability
 */
export const customerReducer: Reducer<CustomerState, CustomerAction> = (
  state = initialState,
  action
): CustomerState => {
  switch (action.type) {
    case CustomerActionTypes.FETCH_CUSTOMERS_REQUEST:
      return {
        ...state,
        loading: true,
        error: null
      };

    case CustomerActionTypes.FETCH_CUSTOMERS_SUCCESS:
      return {
        ...state,
        loading: false,
        customers: [...action.payload],
        error: null
      };

    case CustomerActionTypes.FETCH_CUSTOMERS_FAILURE:
      return {
        ...state,
        loading: false,
        error: action.payload
      };

    case CustomerActionTypes.SELECT_CUSTOMER:
      return {
        ...state,
        selectedCustomer: action.payload
      };

    case CustomerActionTypes.UPDATE_HEALTH_SCORE: {
      const { customerId, healthScore } = action.payload;
      return {
        ...state,
        healthScores: {
          ...state.healthScores,
          [customerId]: {
            ...healthScore,
            lastUpdated: new Date(healthScore.lastUpdated)
          } as CustomerHealthScore
        }
      };
    }

    case CustomerActionTypes.UPDATE_RISK_SCORE: {
      const { customerId, riskAssessment } = action.payload;
      return {
        ...state,
        riskAssessments: {
          ...state.riskAssessments,
          [customerId]: {
            ...riskAssessment,
            lastUpdated: new Date(riskAssessment.lastUpdated)
          } as CustomerRiskAssessment
        }
      };
    }

    case CustomerActionTypes.UPDATE_REVENUE_DATA: {
      const { customerId, revenueData } = action.payload;
      return {
        ...state,
        revenueData: {
          ...state.revenueData,
          [customerId]: {
            ...revenueData,
            lastUpdated: new Date(revenueData.lastUpdated)
          } as CustomerRevenue
        }
      };
    }

    case CustomerActionTypes.ADD_INTERACTION: {
      const newInteraction: CustomerInteraction = {
        ...action.payload,
        timestamp: new Date(action.payload.timestamp)
      };
      return {
        ...state,
        interactions: [
          newInteraction,
          ...state.interactions
        ]
      };
    }

    default: {
      // Exhaustive type checking to ensure all action types are handled
      const _exhaustiveCheck: never = action;
      return state;
    }
  }
};