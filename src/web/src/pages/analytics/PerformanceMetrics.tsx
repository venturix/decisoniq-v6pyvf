import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Grid, Select, Button, DataGrid } from '@blitzy/premium-ui'; // ^2.0.0
import MetricsCard from '../../components/analytics/MetricsCard';
import ChartContainer from '../../components/analytics/ChartContainer';
import { metricsApi } from '../../lib/api/metrics';
import { useTheme } from '../../lib/blitzy/theme';
import { 
  MetricType, 
  TimeInterval, 
  TimeRangePreset,
  type AggregateMetric,
  type MetricTimeRange 
} from '../../types/metrics';
import { BREAKPOINTS } from '../../config/constants';

interface PerformanceMetricsProps {
  className?: string;
  timeRange?: MetricTimeRange;
  onExport?: () => void;
}

/**
 * Custom hook for managing metrics data with caching and error handling
 */
const useMetricsData = (timeRange: MetricTimeRange) => {
  const [metrics, setMetrics] = useState<Record<MetricType, AggregateMetric>>({} as Record<MetricType, AggregateMetric>);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const metricTypes = Object.values(MetricType);
      const promises = metricTypes.map(type => 
        metricsApi.getAggregatedMetrics(type, timeRange, { validateData: true })
      );
      
      const results = await Promise.all(promises);
      const metricsData = results.reduce((acc, response, index) => ({
        ...acc,
        [metricTypes[index]]: response.data
      }), {});

      setMetrics(metricsData);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching metrics:', err);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return { metrics, loading, error, refetch: fetchMetrics };
};

/**
 * Performance metrics dashboard component implementing Z-pattern layout
 * with comprehensive analytics visualization and accessibility features
 */
const PerformanceMetrics: React.FC<PerformanceMetricsProps> = ({
  className,
  timeRange = {
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    end: new Date(),
    interval: TimeInterval.DAILY,
    preset: TimeRangePreset.LAST_30_DAYS,
    metadata: {
      dataPoints: 30,
      completeness: 1,
      quality: 'HIGH'
    }
  },
  onExport
}) => {
  const { theme } = useTheme();
  const { metrics, loading, error, refetch } = useMetricsData(timeRange);

  // Grid layout configuration based on breakpoints
  const gridLayout = useMemo(() => ({
    [BREAKPOINTS.MOBILE]: { columns: 1, gap: 16 },
    [BREAKPOINTS.TABLET]: { columns: 2, gap: 24 },
    [BREAKPOINTS.DESKTOP]: { columns: 3, gap: 32 },
    [BREAKPOINTS.LARGE]: { columns: 4, gap: 32 }
  }), []);

  // Time range options for the selector
  const timeRangeOptions = useMemo(() => [
    { value: TimeRangePreset.LAST_24_HOURS, label: 'Last 24 Hours' },
    { value: TimeRangePreset.LAST_7_DAYS, label: 'Last 7 Days' },
    { value: TimeRangePreset.LAST_30_DAYS, label: 'Last 30 Days' },
    { value: TimeRangePreset.LAST_90_DAYS, label: 'Last 90 Days' },
    { value: TimeRangePreset.LAST_12_MONTHS, label: 'Last 12 Months' }
  ], []);

  return (
    <div 
      className={`performance-metrics ${className || ''}`}
      role="region"
      aria-label="Performance Metrics Dashboard"
    >
      {/* Dashboard Header */}
      <div className="performance-metrics__header mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Performance Analytics</h1>
        <div className="flex items-center gap-4">
          <Select
            options={timeRangeOptions}
            value={timeRange.preset}
            onChange={() => {}}
            aria-label="Select time range"
            className="w-48"
          />
          <Button
            variant="secondary"
            onClick={onExport}
            icon="download"
            aria-label="Export metrics data"
          >
            Export
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div 
          role="alert" 
          className="mb-6 p-4 bg-danger text-white rounded-lg"
        >
          {error.message}
          <Button
            variant="text"
            onClick={refetch}
            className="ml-4"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Metrics Grid - Z-Pattern Layout */}
      <Grid
        columns={gridLayout[BREAKPOINTS.DESKTOP].columns}
        gap={gridLayout[BREAKPOINTS.DESKTOP].gap}
        className="mb-8"
      >
        {/* Primary KPIs */}
        <MetricsCard
          type={MetricType.CHURN_RATE}
          metric={metrics[MetricType.CHURN_RATE]}
          title="Churn Rate"
          description="Monthly customer churn rate"
          loading={loading}
        />
        <MetricsCard
          type={MetricType.REVENUE_IMPACT}
          metric={metrics[MetricType.REVENUE_IMPACT]}
          title="Revenue Impact"
          description="Financial impact of customer success initiatives"
          loading={loading}
        />
        <MetricsCard
          type={MetricType.OPERATIONAL_EFFICIENCY}
          metric={metrics[MetricType.OPERATIONAL_EFFICIENCY]}
          title="Operational Efficiency"
          description="Automation and process optimization metrics"
          loading={loading}
        />
        <MetricsCard
          type={MetricType.CSM_ACTIVATION}
          metric={metrics[MetricType.CSM_ACTIVATION]}
          title="CSM Activation"
          description="Customer success manager platform adoption"
          loading={loading}
        />
      </Grid>

      {/* Detailed Analytics Charts */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <ChartContainer
          title="Churn Trend Analysis"
          loading={loading}
          error={error?.message}
          height={400}
        >
          {/* Chart implementation */}
        </ChartContainer>
        <ChartContainer
          title="Revenue Impact Overview"
          loading={loading}
          error={error?.message}
          height={400}
        >
          {/* Chart implementation */}
        </ChartContainer>
      </div>

      {/* Intervention Success Metrics */}
      <ChartContainer
        title="Intervention Success Metrics"
        loading={loading}
        error={error?.message}
        height={500}
        className="mb-8"
      >
        <DataGrid
          columns={[
            { field: 'type', headerName: 'Intervention Type', width: 200 },
            { field: 'success_rate', headerName: 'Success Rate', width: 150 },
            { field: 'revenue_impact', headerName: 'Revenue Impact', width: 200 },
            { field: 'completion_time', headerName: 'Avg. Completion Time', width: 200 }
          ]}
          rows={[]}
          loading={loading}
          pagination
          sortable
        />
      </ChartContainer>
    </div>
  );
};

PerformanceMetrics.displayName = 'PerformanceMetrics';

export default PerformanceMetrics;