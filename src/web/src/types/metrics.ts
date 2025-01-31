/**
 * Type definitions for metrics and KPIs used throughout the Customer Success AI Platform
 * @version 1.0.0
 * @package @customer-success-ai/web
 */

import type { ApiResponse } from './api';
import type { Customer } from './customer';

/**
 * Enum of available metric types aligned with business KPIs
 */
export enum MetricType {
  CHURN_RATE = 'CHURN_RATE',
  REVENUE_IMPACT = 'REVENUE_IMPACT',
  HEALTH_SCORE = 'HEALTH_SCORE',
  RISK_SCORE = 'RISK_SCORE',
  INTERVENTION_SUCCESS = 'INTERVENTION_SUCCESS',
  OPERATIONAL_EFFICIENCY = 'OPERATIONAL_EFFICIENCY',
  EXPANSION_REVENUE = 'EXPANSION_REVENUE',
  RETENTION_RATE = 'RETENTION_RATE',
  CSM_ACTIVATION = 'CSM_ACTIVATION',
  SYSTEM_PERFORMANCE = 'SYSTEM_PERFORMANCE'
}

/**
 * Enum for metric trend analysis
 */
export enum MetricTrend {
  IMPROVING = 'IMPROVING',
  STABLE = 'STABLE',
  WORSENING = 'WORSENING'
}

/**
 * Enum for time interval granularity
 */
export enum TimeInterval {
  HOURLY = 'HOURLY',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY'
}

/**
 * Type for predefined time range selections
 */
export enum TimeRangePreset {
  LAST_24_HOURS = 'LAST_24_HOURS',
  LAST_7_DAYS = 'LAST_7_DAYS',
  LAST_30_DAYS = 'LAST_30_DAYS',
  LAST_90_DAYS = 'LAST_90_DAYS',
  LAST_12_MONTHS = 'LAST_12_MONTHS',
  CUSTOM = 'CUSTOM'
}

/**
 * Type for data quality indicators
 */
export enum DataQuality {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  INSUFFICIENT = 'INSUFFICIENT'
}

/**
 * Type for threshold breach trend analysis
 */
export enum ThresholdTrend {
  IMPROVING = 'IMPROVING',
  WORSENING = 'WORSENING',
  STABLE = 'STABLE'
}

/**
 * Interface for individual metric values with metadata
 */
export interface MetricValue {
  readonly type: MetricType;
  readonly value: number;
  readonly timestamp: Date;
  readonly metadata: Record<string, any>;
}

/**
 * Interface for aggregated metric data with trends
 */
export interface AggregateMetric {
  readonly type: MetricType;
  readonly current: number;
  readonly previous: number;
  readonly target: number;
  readonly trend: MetricTrend;
}

/**
 * Enhanced interface for metric threshold configuration
 */
export interface MetricThreshold {
  readonly type: MetricType;
  readonly warning: number;
  readonly critical: number;
  readonly target: number;
  readonly metadata: ThresholdMetadata;
}

/**
 * Interface for threshold breach tracking and analysis
 */
export interface ThresholdMetadata {
  readonly lastBreachDate: Date;
  readonly breachCount: number;
  readonly breachTrend: ThresholdTrend;
}

/**
 * Enhanced interface for metric time range selection
 */
export interface MetricTimeRange {
  readonly start: Date;
  readonly end: Date;
  readonly interval: TimeInterval;
  readonly preset: TimeRangePreset;
  readonly metadata: TimeRangeMetadata;
}

/**
 * Interface for time range analysis metadata
 */
export interface TimeRangeMetadata {
  readonly dataPoints: number;
  readonly completeness: number;
  readonly quality: DataQuality;
}

/**
 * Enhanced type for metric data points with confidence intervals
 */
export interface MetricDataPoint {
  readonly timestamp: Date;
  readonly value: number;
  readonly confidenceLow: number;
  readonly confidenceHigh: number;
  readonly quality: DataQuality;
}

/**
 * Interface for metric comparison analysis
 */
export interface MetricComparison {
  readonly metric: MetricType;
  readonly baseline: number;
  readonly current: number;
  readonly percentChange: number;
  readonly significance: number;
}

/**
 * Interface for metric target tracking
 */
export interface MetricTarget {
  readonly metric: MetricType;
  readonly target: number;
  readonly current: number;
  readonly progress: number;
  readonly projectedDate: Date;
}

/**
 * Interface for intervention success metrics
 */
export interface InterventionMetrics {
  readonly successRate: number;
  readonly averageTimeToResolution: number;
  readonly costPerIntervention: number;
  readonly revenueImpact: number;
}

/**
 * Type alias for metric response from API
 */
export type MetricResponse = ApiResponse<MetricValue>;
export type MetricListResponse = ApiResponse<MetricValue[]>;
export type AggregateMetricResponse = ApiResponse<AggregateMetric>;

/**
 * Type guard to check if a metric meets target threshold
 */
export function meetsTarget(metric: AggregateMetric): boolean {
  return metric.current >= metric.target;
}

/**
 * Type guard to check if a metric requires attention
 */
export function requiresAttention(metric: MetricValue, threshold: MetricThreshold): boolean {
  return metric.value <= threshold.warning || metric.value <= threshold.critical;
}