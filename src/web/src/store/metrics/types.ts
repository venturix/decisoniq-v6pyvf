/**
 * Redux state management type definitions for customer success metrics
 * @version 1.0.0
 * @package @customer-success-ai/web
 */

import { Action } from 'redux'; // ^4.2.1
import { 
  CustomerMetric, 
  AggregateMetric, 
  MetricType,
  DataQuality,
  TimeInterval
} from '../../types/metrics';

/**
 * Enum of available action types for metrics state management
 */
export enum MetricsActionTypes {
  FETCH_METRICS_REQUEST = '@metrics/FETCH_METRICS_REQUEST',
  FETCH_METRICS_SUCCESS = '@metrics/FETCH_METRICS_SUCCESS',
  FETCH_METRICS_FAILURE = '@metrics/FETCH_METRICS_FAILURE',
  UPDATE_CUSTOMER_METRICS = '@metrics/UPDATE_CUSTOMER_METRICS',
  UPDATE_AGGREGATE_METRICS = '@metrics/UPDATE_AGGREGATE_METRICS',
  SET_TIME_RANGE = '@metrics/SET_TIME_RANGE',
  UPDATE_VALIDATION_STATE = '@metrics/UPDATE_VALIDATION_STATE',
  UPDATE_VISUALIZATION_STATE = '@metrics/UPDATE_VISUALIZATION_STATE'
}

/**
 * Enum for available chart visualization types
 */
export enum ChartType {
  LINE = 'LINE',
  BAR = 'BAR',
  PIE = 'PIE',
  AREA = 'AREA',
  SCATTER = 'SCATTER'
}

/**
 * Enum for filter operators in metric filtering
 */
export enum FilterOperator {
  EQUALS = 'EQUALS',
  GREATER_THAN = 'GREATER_THAN',
  LESS_THAN = 'LESS_THAN',
  BETWEEN = 'BETWEEN',
  CONTAINS = 'CONTAINS'
}

/**
 * Enum for metric grouping types
 */
export enum GroupingType {
  SUM = 'SUM',
  AVERAGE = 'AVERAGE',
  COUNT = 'COUNT',
  MIN = 'MIN',
  MAX = 'MAX'
}

/**
 * Interface for metrics validation state
 */
export interface MetricsValidationState {
  isValid: boolean;
  validationErrors: Record<string, string[]>;
  dataQuality: DataQuality;
}

/**
 * Interface for metrics visualization configuration
 */
export interface MetricsVisualizationState {
  chartType: ChartType;
  filters: MetricsFilter[];
  grouping: MetricsGrouping;
}

/**
 * Interface for metrics time range selection
 */
export interface MetricsTimeRange {
  start: number;
  end: number;
  interval: TimeInterval;
}

/**
 * Interface for detailed metrics error information
 */
export interface MetricsError {
  code: string;
  message: string;
  context: Record<string, unknown>;
}

/**
 * Interface for metrics filtering options
 */
export interface MetricsFilter {
  field: string;
  operator: FilterOperator;
  value: unknown;
}

/**
 * Interface for metrics grouping options
 */
export interface MetricsGrouping {
  field: string;
  type: GroupingType;
}

/**
 * Interface defining the shape of metrics state in Redux store
 */
export interface MetricsState {
  customerMetrics: Record<string, CustomerMetric[]>;
  aggregateMetrics: Record<string, AggregateMetric>;
  loading: boolean;
  error: MetricsError | null;
  validationState: MetricsValidationState;
  visualizationState: MetricsVisualizationState;
  timeRange: MetricsTimeRange;
  lastUpdated: number;
}

/**
 * Action interfaces for metrics state management
 */
export interface FetchMetricsRequestAction extends Action<MetricsActionTypes.FETCH_METRICS_REQUEST> {
  payload: MetricsTimeRange;
}

export interface FetchMetricsSuccessAction extends Action<MetricsActionTypes.FETCH_METRICS_SUCCESS> {
  payload: {
    customerMetrics: Record<string, CustomerMetric[]>;
    aggregateMetrics: Record<string, AggregateMetric>;
  };
}

export interface FetchMetricsFailureAction extends Action<MetricsActionTypes.FETCH_METRICS_FAILURE> {
  payload: MetricsError;
}

export interface UpdateCustomerMetricsAction extends Action<MetricsActionTypes.UPDATE_CUSTOMER_METRICS> {
  payload: {
    customerId: string;
    metrics: CustomerMetric[];
  };
}

export interface UpdateAggregateMetricsAction extends Action<MetricsActionTypes.UPDATE_AGGREGATE_METRICS> {
  payload: Record<string, AggregateMetric>;
}

export interface SetTimeRangeAction extends Action<MetricsActionTypes.SET_TIME_RANGE> {
  payload: MetricsTimeRange;
}

export interface UpdateValidationStateAction extends Action<MetricsActionTypes.UPDATE_VALIDATION_STATE> {
  payload: MetricsValidationState;
}

export interface UpdateVisualizationStateAction extends Action<MetricsActionTypes.UPDATE_VISUALIZATION_STATE> {
  payload: MetricsVisualizationState;
}

/**
 * Union type of all possible metrics actions
 */
export type MetricsAction =
  | FetchMetricsRequestAction
  | FetchMetricsSuccessAction
  | FetchMetricsFailureAction
  | UpdateCustomerMetricsAction
  | UpdateAggregateMetricsAction
  | SetTimeRangeAction
  | UpdateValidationStateAction
  | UpdateVisualizationStateAction;