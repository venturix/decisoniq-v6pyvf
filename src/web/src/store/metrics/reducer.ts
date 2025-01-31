/**
 * Redux reducer for customer success metrics state management
 * Handles metrics data, validation, visualization and analytics state
 * @version 1.0.0
 * @package @customer-success-ai/web
 */

import type { Reducer } from 'redux'; // ^4.2.1
import {
  MetricsState,
  MetricsAction,
  MetricsActionTypes,
  DataQuality,
  ChartType,
  GroupingType,
  FilterOperator,
  TimeInterval
} from './types';

/**
 * Initial state for metrics management with comprehensive validation and visualization support
 */
const initialState: MetricsState = {
  customerMetrics: {},
  aggregateMetrics: {},
  loading: false,
  error: null,
  validationState: {
    isValid: true,
    validationErrors: {},
    dataQuality: DataQuality.HIGH
  },
  visualizationState: {
    chartType: ChartType.LINE,
    filters: [],
    grouping: {
      field: 'date',
      type: GroupingType.AVERAGE
    }
  },
  timeRange: {
    start: Date.now() - 30 * 24 * 60 * 60 * 1000, // Last 30 days
    end: Date.now(),
    interval: TimeInterval.DAILY
  },
  lastUpdated: Date.now()
};

/**
 * Enhanced metrics reducer with comprehensive state management
 * Handles data quality validation and visualization preferences
 */
export const metricsReducer: Reducer<MetricsState, MetricsAction> = (
  state = initialState,
  action
): MetricsState => {
  switch (action.type) {
    case MetricsActionTypes.FETCH_METRICS_REQUEST:
      return {
        ...state,
        loading: true,
        error: null
      };

    case MetricsActionTypes.FETCH_METRICS_SUCCESS:
      return {
        ...state,
        loading: false,
        customerMetrics: {
          ...state.customerMetrics,
          ...action.payload.customerMetrics
        },
        aggregateMetrics: {
          ...state.aggregateMetrics,
          ...action.payload.aggregateMetrics
        },
        lastUpdated: Date.now(),
        validationState: {
          ...state.validationState,
          isValid: true,
          validationErrors: {}
        }
      };

    case MetricsActionTypes.FETCH_METRICS_FAILURE:
      return {
        ...state,
        loading: false,
        error: action.payload,
        validationState: {
          ...state.validationState,
          isValid: false,
          validationErrors: {
            fetch: [action.payload.message]
          }
        }
      };

    case MetricsActionTypes.UPDATE_CUSTOMER_METRICS:
      return {
        ...state,
        customerMetrics: {
          ...state.customerMetrics,
          [action.payload.customerId]: action.payload.metrics
        },
        lastUpdated: Date.now(),
        validationState: {
          ...state.validationState,
          dataQuality: validateMetricsQuality(action.payload.metrics)
        }
      };

    case MetricsActionTypes.UPDATE_AGGREGATE_METRICS:
      return {
        ...state,
        aggregateMetrics: {
          ...state.aggregateMetrics,
          ...action.payload
        },
        lastUpdated: Date.now()
      };

    case MetricsActionTypes.SET_TIME_RANGE:
      return {
        ...state,
        timeRange: action.payload,
        lastUpdated: Date.now()
      };

    case MetricsActionTypes.UPDATE_VALIDATION_STATE:
      return {
        ...state,
        validationState: {
          ...state.validationState,
          ...action.payload
        },
        lastUpdated: Date.now()
      };

    case MetricsActionTypes.UPDATE_VISUALIZATION_STATE:
      return {
        ...state,
        visualizationState: {
          ...state.visualizationState,
          ...action.payload
        },
        lastUpdated: Date.now()
      };

    default:
      return state;
  }
};

/**
 * Helper function to validate metrics data quality
 * @param metrics Array of customer metrics to validate
 * @returns DataQuality enum indicating overall quality level
 */
function validateMetricsQuality(metrics: any[]): DataQuality {
  if (!metrics || metrics.length === 0) {
    return DataQuality.INSUFFICIENT;
  }

  const validDataPoints = metrics.filter(metric => 
    metric && 
    typeof metric.value === 'number' && 
    !isNaN(metric.value) &&
    metric.timestamp instanceof Date
  );

  const qualityRatio = validDataPoints.length / metrics.length;

  if (qualityRatio >= 0.9) {
    return DataQuality.HIGH;
  } else if (qualityRatio >= 0.7) {
    return DataQuality.MEDIUM;
  } else if (qualityRatio >= 0.5) {
    return DataQuality.LOW;
  }

  return DataQuality.INSUFFICIENT;
}