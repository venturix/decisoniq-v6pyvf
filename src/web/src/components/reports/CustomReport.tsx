import React from 'react'; // ^18.0.0
import classNames from 'classnames'; // ^2.3.2
import { useSelector } from 'react-redux'; // ^8.1.0
import { useTranslation } from 'react-i18next'; // ^13.0.0
import Card from '../common/Card';
import ChartContainer from '../analytics/ChartContainer';
import ErrorBoundary from '../common/ErrorBoundary';
import { useTheme } from '../../hooks/useTheme';

// Metric type definitions
type MetricType = 'churn_rate' | 'revenue_impact' | 'health_score' | 'intervention_success' | 'operational_efficiency';

interface MetricContext {
  period: string;
  value: number;
  trend: number;
  target?: number;
}

interface ReportConfig {
  title: string;
  description?: string;
  metrics: MetricType[];
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  showTargets?: boolean;
  layout?: 'grid' | 'list';
}

interface CustomReportProps {
  config: ReportConfig;
  className?: string;
  onMetricClick?: (metricType: MetricType, context: MetricContext) => void;
  'aria-label'?: string;
  highContrastMode?: boolean;
  errorBoundaryFallback?: React.ReactNode;
}

// Constants for metric labels and chart colors
const METRIC_LABELS: Record<MetricType, string> = {
  churn_rate: 'Churn Rate',
  revenue_impact: 'Revenue Impact',
  health_score: 'Customer Health',
  intervention_success: 'Intervention Success',
  operational_efficiency: 'Operational Efficiency'
};

const CHART_COLORS = {
  default: ['#4C9AFF', '#FF5630', '#36B37E', '#6554C0', '#FFAB00'],
  highContrast: ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF']
};

const ACCESSIBILITY_LABELS = {
  reportTitle: 'Customer Success Analytics Report',
  metricsSection: 'Key Performance Metrics',
  chartSection: 'Performance Visualizations'
};

const CustomReport: React.FC<CustomReportProps> = React.memo(({
  config,
  className,
  onMetricClick,
  'aria-label': ariaLabel,
  highContrastMode,
  errorBoundaryFallback
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  
  // Get metrics data from Redux store
  const metricsData = useSelector((state: any) => state.analytics.metrics);
  const isLoading = useSelector((state: any) => state.analytics.loading);
  const error = useSelector((state: any) => state.analytics.error);

  // Process metrics data with data quality validation
  const processedMetrics = React.useMemo(() => {
    return config.metrics.map(metricType => {
      const data = metricsData?.[metricType];
      if (!data) return null;

      return {
        type: metricType,
        label: t(`metrics.${metricType}`, METRIC_LABELS[metricType]),
        value: data.current,
        trend: data.trend,
        target: config.showTargets ? data.target : undefined,
        period: config.period
      };
    }).filter(Boolean);
  }, [metricsData, config.metrics, config.showTargets, config.period, t]);

  // Generate container classes with proper theme support
  const containerClasses = classNames(
    'custom-report',
    {
      'custom-report--grid': config.layout === 'grid',
      'custom-report--list': config.layout === 'list',
      'custom-report--high-contrast': highContrastMode || theme.mode === 'high-contrast'
    },
    className
  );

  // Handle metric click with context
  const handleMetricClick = React.useCallback((metric: MetricType, context: MetricContext) => {
    if (onMetricClick) {
      onMetricClick(metric, context);
    }
  }, [onMetricClick]);

  return (
    <ErrorBoundary fallback={errorBoundaryFallback}>
      <div 
        className={containerClasses}
        role="region"
        aria-label={ariaLabel || ACCESSIBILITY_LABELS.reportTitle}
      >
        {/* Report Header */}
        <Card
          className="custom-report__header"
          variant="default"
          highContrast={highContrastMode}
        >
          <h2 className="text-xl font-semibold mb-2">
            {t('reports.title', config.title)}
          </h2>
          {config.description && (
            <p className="text-sm text-textSecondary">
              {t('reports.description', config.description)}
            </p>
          )}
        </Card>

        {/* Metrics Grid */}
        <div 
          className="custom-report__metrics mt-4 grid gap-4"
          style={{ 
            gridTemplateColumns: config.layout === 'grid' 
              ? 'repeat(auto-fit, minmax(300px, 1fr))' 
              : '1fr'
          }}
          role="region"
          aria-label={ACCESSIBILITY_LABELS.metricsSection}
        >
          {processedMetrics.map(metric => (
            <Card
              key={metric.type}
              className="custom-report__metric"
              variant="elevated"
              highContrast={highContrastMode}
              onClick={() => handleMetricClick(metric.type, {
                period: metric.period,
                value: metric.value,
                trend: metric.trend,
                target: metric.target
              })}
            >
              <ChartContainer
                title={metric.label}
                loading={isLoading}
                error={error}
                height={200}
              >
                {/* Chart content would be rendered here */}
                <div 
                  className="metric-content p-4"
                  style={{ color: theme.colors.text }}
                >
                  <div className="metric-value text-2xl font-bold">
                    {metric.value}%
                  </div>
                  <div className={classNames(
                    'metric-trend text-sm',
                    metric.trend > 0 ? 'text-success' : 'text-danger'
                  )}>
                    {metric.trend > 0 ? '↑' : '↓'} {Math.abs(metric.trend)}%
                  </div>
                  {metric.target && (
                    <div className="metric-target text-sm text-textSecondary">
                      {t('metrics.target')}: {metric.target}%
                    </div>
                  )}
                </div>
              </ChartContainer>
            </Card>
          ))}
        </div>
      </div>
    </ErrorBoundary>
  );
});

CustomReport.displayName = 'CustomReport';

export default CustomReport;
export type { CustomReportProps, ReportConfig, MetricType, MetricContext };