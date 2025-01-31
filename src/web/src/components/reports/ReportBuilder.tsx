import React, { useCallback, useMemo, useState } from 'react'; // ^18.0.0
import classNames from 'classnames'; // ^2.3.2
import { useSelector } from 'react-redux'; // ^8.1.0
import * as yup from 'yup'; // ^1.0.0

import { Card } from '../common/Card';
import { Select } from '../common/Select';
import { ExportOptions } from './ExportOptions';
import type { MetricsState } from '../../store/metrics/types';
import { ValidationError } from '../../utils/validation';
import { MetricType, TimeInterval, DataQuality } from '../../types/metrics';

// Constants for report configuration
const METRIC_TYPES = [
  { value: MetricType.CHURN_RATE, label: 'Churn Rate', target: 30 },
  { value: MetricType.REVENUE_IMPACT, label: 'Revenue Impact', target: 15 },
  { value: MetricType.HEALTH_SCORE, label: 'Health Score', target: 85 },
  { value: MetricType.INTERVENTION_SUCCESS, label: 'Intervention Success', target: 75 }
] as const;

const TIME_INTERVALS = [
  { value: TimeInterval.DAILY, label: 'Daily' },
  { value: TimeInterval.WEEKLY, label: 'Weekly' },
  { value: TimeInterval.MONTHLY, label: 'Monthly' }
] as const;

const VISUALIZATION_TYPES = [
  { value: 'line', label: 'Line Chart', accessibility: true },
  { value: 'bar', label: 'Bar Chart', accessibility: true },
  { value: 'pie', label: 'Pie Chart', accessibility: true },
  { value: 'table', label: 'Data Table', accessibility: true }
] as const;

// Validation schema for report configuration
const reportConfigSchema = yup.object().shape({
  title: yup.string().required('Report title is required'),
  metrics: yup.array().of(
    yup.string().oneOf(METRIC_TYPES.map(m => m.value))
  ).min(1, 'At least one metric must be selected'),
  timeInterval: yup.string().oneOf(TIME_INTERVALS.map(t => t.value)),
  visualizations: yup.array().of(
    yup.string().oneOf(VISUALIZATION_TYPES.map(v => v.value))
  ).min(1, 'At least one visualization must be selected')
});

interface ReportBuilderProps {
  initialConfig?: ReportConfig;
  onConfigChange: (config: ReportConfig) => void;
  className?: string;
  theme?: BlitzyThemeConfig;
  validationRules?: ValidationRules;
}

interface ReportConfig {
  title: string;
  metrics: MetricType[];
  timeInterval: TimeInterval;
  visualizations: string[];
  validation?: ValidationConfig;
}

interface ValidationConfig {
  dataQualityThreshold: DataQuality;
  minimumDataPoints: number;
}

const ReportBuilder: React.FC<ReportBuilderProps> = React.memo(({
  initialConfig,
  onConfigChange,
  className,
  theme,
  validationRules
}) => {
  // State management
  const [config, setConfig] = useState<ReportConfig>(initialConfig || {
    title: '',
    metrics: [],
    timeInterval: TimeInterval.DAILY,
    visualizations: ['line'],
    validation: {
      dataQualityThreshold: DataQuality.HIGH,
      minimumDataPoints: 30
    }
  });

  // Redux state selectors
  const { customerMetrics, aggregateMetrics } = useSelector((state: { metrics: MetricsState }) => state.metrics);

  // Memoized validation function
  const validateConfig = useCallback(async (newConfig: ReportConfig): Promise<boolean> => {
    try {
      await reportConfigSchema.validate(newConfig, { abortEarly: false });
      
      // Validate data quality
      const hasEnoughData = newConfig.metrics.every(metric => {
        const metricData = customerMetrics[metric] || [];
        return metricData.length >= (newConfig.validation?.minimumDataPoints || 30);
      });

      if (!hasEnoughData) {
        throw new ValidationError(
          'Insufficient data points for selected metrics',
          'metrics',
          'INSUFFICIENT_DATA'
        );
      }

      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      if (error instanceof yup.ValidationError) {
        throw new ValidationError(
          error.message,
          error.path || 'config',
          'VALIDATION_ERROR'
        );
      }
      return false;
    }
  }, [customerMetrics]);

  // Handle metric selection changes
  const handleMetricChange = useCallback(async (selectedMetrics: string[]) => {
    const newConfig = {
      ...config,
      metrics: selectedMetrics as MetricType[]
    };

    try {
      if (await validateConfig(newConfig)) {
        setConfig(newConfig);
        onConfigChange(newConfig);
      }
    } catch (error) {
      console.error('Metric selection error:', error);
    }
  }, [config, onConfigChange, validateConfig]);

  // Handle visualization changes
  const handleVisualizationChange = useCallback(async (selectedVisualizations: string[]) => {
    const newConfig = {
      ...config,
      visualizations: selectedVisualizations
    };

    try {
      if (await validateConfig(newConfig)) {
        setConfig(newConfig);
        onConfigChange(newConfig);
      }
    } catch (error) {
      console.error('Visualization selection error:', error);
    }
  }, [config, onConfigChange, validateConfig]);

  // Generate accessible class names
  const containerClasses = useMemo(() => classNames(
    'report-builder',
    'space-y-6',
    {
      'theme-light': theme?.mode === 'light',
      'theme-dark': theme?.mode === 'dark',
      'high-contrast': theme?.mode === 'high-contrast'
    },
    className
  ), [theme, className]);

  return (
    <div 
      className={containerClasses}
      role="region"
      aria-label="Report Builder"
    >
      <Card>
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Configure Report</h2>
          
          {/* Metric Selection */}
          <div className="space-y-2">
            <label 
              htmlFor="metrics"
              className="block font-medium"
            >
              Select Metrics
            </label>
            <Select
              id="metrics"
              name="metrics"
              options={METRIC_TYPES.map(metric => ({
                value: metric.value,
                label: `${metric.label} (Target: ${metric.target}%)`
              }))}
              value={config.metrics}
              onChange={handleMetricChange}
              required
              aria-required="true"
              aria-describedby="metrics-help"
              multiple
            />
            <p id="metrics-help" className="text-sm text-gray-500">
              Select one or more metrics to include in your report
            </p>
          </div>

          {/* Time Interval Selection */}
          <div className="space-y-2">
            <label
              htmlFor="timeInterval"
              className="block font-medium"
            >
              Time Interval
            </label>
            <Select
              id="timeInterval"
              name="timeInterval"
              options={TIME_INTERVALS}
              value={config.timeInterval}
              onChange={(value) => {
                const newConfig = { ...config, timeInterval: value as TimeInterval };
                setConfig(newConfig);
                onConfigChange(newConfig);
              }}
              required
              aria-required="true"
            />
          </div>

          {/* Visualization Selection */}
          <div className="space-y-2">
            <label
              htmlFor="visualizations"
              className="block font-medium"
            >
              Visualizations
            </label>
            <Select
              id="visualizations"
              name="visualizations"
              options={VISUALIZATION_TYPES}
              value={config.visualizations}
              onChange={handleVisualizationChange}
              required
              aria-required="true"
              multiple
            />
          </div>
        </div>
      </Card>

      {/* Export Options */}
      <Card>
        <ExportOptions
          onExport={async (format, options) => {
            // Implementation for export functionality
            console.log('Exporting report:', { format, options });
          }}
          disabled={!config.metrics.length}
          onError={(error) => {
            console.error('Export error:', error);
          }}
        />
      </Card>
    </div>
  );
});

ReportBuilder.displayName = 'ReportBuilder';

export default ReportBuilder;