/**
 * TypeScript type definitions for analytics data structures and interfaces
 * @version 1.0.0
 * @package @customer-success-ai/web
 */

import type { ChartConfiguration } from 'chart.js'; // ^4.0.0
import type { ApiResponse } from './api';
import type { Customer } from './customer';
import type { MetricType } from './metrics';

/**
 * Enum for different types of analytics widgets
 */
export enum WidgetType {
  LINE_CHART = 'LINE_CHART',
  BAR_CHART = 'BAR_CHART',
  PIE_CHART = 'PIE_CHART',
  METRIC_CARD = 'METRIC_CARD',
  TABLE = 'TABLE',
  HEATMAP = 'HEATMAP',
  GAUGE = 'GAUGE',
  FUNNEL = 'FUNNEL',
  SCATTER_PLOT = 'SCATTER_PLOT',
  RADAR_CHART = 'RADAR_CHART'
}

/**
 * Enum for analytics time range selection
 */
export enum TimeRange {
  LAST_24H = 'LAST_24H',
  LAST_7D = 'LAST_7D',
  LAST_30D = 'LAST_30D',
  LAST_90D = 'LAST_90D',
  LAST_180D = 'LAST_180D',
  LAST_365D = 'LAST_365D',
  CUSTOM = 'CUSTOM',
  YTD = 'YTD',
  QTD = 'QTD',
  MTD = 'MTD'
}

/**
 * Interface for trend analysis in data series
 */
export interface TrendAnalysis {
  readonly direction: 'up' | 'down' | 'stable';
  readonly percentage: number;
  readonly comparisonPeriod: TimeRange;
}

/**
 * Interface for data series with enhanced type safety
 */
export interface DataSeries {
  readonly name: string;
  readonly data: ReadonlyArray<number>;
  readonly color: string;
  readonly trend: TrendAnalysis;
  readonly metadata: Readonly<Record<string, unknown>>;
}

/**
 * Interface for widget configuration options
 */
export interface WidgetConfig {
  readonly title: string;
  readonly chartType: ChartType;
  readonly timeRange: TimeRange;
  readonly refreshInterval: number;
  readonly chartConfig: ChartConfiguration;
  readonly thresholds: Record<string, number>;
}

/**
 * Interface for widget data with strict typing
 */
export interface WidgetData {
  readonly series: ReadonlyArray<DataSeries>;
  readonly labels: ReadonlyArray<string>;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly timestamp: number;
}

/**
 * Interface for analytics dashboard configuration
 */
export interface AnalyticsDashboard {
  readonly id: string;
  readonly name: string;
  readonly widgets: ReadonlyArray<AnalyticsWidget>;
  readonly layout: DashboardLayout;
  readonly refreshInterval: number;
}

/**
 * Interface for individual analytics widgets
 */
export interface AnalyticsWidget {
  readonly id: string;
  readonly type: WidgetType;
  readonly config: WidgetConfig;
  readonly data: WidgetData;
}

/**
 * Interface for dashboard layout configuration
 */
export interface DashboardLayout {
  readonly columns: number;
  readonly rows: number;
  readonly widgetPositions: ReadonlyArray<WidgetPosition>;
}

/**
 * Interface for widget positioning in dashboard grid
 */
export interface WidgetPosition {
  readonly widgetId: string;
  readonly column: number;
  readonly row: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Type for chart types supported by the analytics system
 */
export type ChartType = keyof typeof WidgetType;

/**
 * Type for analytics API responses
 */
export type AnalyticsDashboardResponse = ApiResponse<AnalyticsDashboard>;
export type AnalyticsWidgetResponse = ApiResponse<AnalyticsWidget>;
export type AnalyticsDataResponse = ApiResponse<WidgetData>;

/**
 * Type guard to check if widget requires real-time updates
 */
export function requiresRealTimeUpdates(widget: AnalyticsWidget): boolean {
  return widget.config.refreshInterval < 60000; // Less than 1 minute
}

/**
 * Type guard to check if widget has critical thresholds breached
 */
export function hasCriticalThresholds(widget: AnalyticsWidget): boolean {
  const { data, config } = widget;
  return data.series.some(series => {
    const threshold = config.thresholds[series.name];
    return threshold && series.data[series.data.length - 1] > threshold;
  });
}