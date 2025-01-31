import React, { useCallback, useMemo, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import ReportBuilder from '../../components/reports/ReportBuilder';
import CustomReport from '../../components/reports/CustomReport';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import { useTheme } from '../../hooks/useTheme';
import type { MetricsState } from '../../store/metrics/types';
import { ValidationError } from '../../utils/validation';
import type { MetricType, TimeInterval, DataQuality } from '../../types/metrics';

// Default configuration for new reports
const DEFAULT_REPORT_CONFIG = {
  title: 'New Custom Report',
  metrics: [],
  dateRange: {
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    end: new Date(),
    interval: 'DAILY' as TimeInterval
  },
  visualizations: ['line'],
  accessibility: {
    highContrast: false,
    textSize: 'medium'
  },
  validation: {
    required: ['title', 'metrics'],
    minMetrics: 1,
    dataQualityThreshold: 'HIGH' as DataQuality
  }
} as const;

interface CustomReportsProps {
  className?: string;
  initialReport?: ReportConfig;
}

interface ReportConfig {
  title: string;
  metrics: MetricType[];
  dateRange: {
    start: Date;
    end: Date;
    interval: TimeInterval;
  };
  visualizations: string[];
  accessibility: {
    highContrast: boolean;
    textSize: string;
  };
  validation: {
    required: string[];
    minMetrics: number;
    dataQualityThreshold: DataQuality;
  };
}

interface ReportState {
  currentReport: ReportConfig;
  isEditing: boolean;
  validationErrors: ValidationError[];
}

const CustomReports: React.FC<CustomReportsProps> = React.memo(({ 
  className,
  initialReport 
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const dispatch = useDispatch();

  // Initialize report state
  const [reportState, setReportState] = useState<ReportState>({
    currentReport: initialReport || DEFAULT_REPORT_CONFIG,
    isEditing: !initialReport,
    validationErrors: []
  });

  // Get metrics data from Redux store
  const metrics = useSelector((state: { metrics: MetricsState }) => state.metrics);
  const { customerMetrics, aggregateMetrics } = metrics;

  // Handle report configuration changes
  const handleConfigChange = useCallback((config: ReportConfig) => {
    const errors: ValidationError[] = [];

    // Validate required fields
    config.validation.required.forEach(field => {
      if (!config[field as keyof ReportConfig]) {
        errors.push(new ValidationError(
          `${field} is required`,
          field,
          'REQUIRED_FIELD'
        ));
      }
    });

    // Validate metrics selection
    if (config.metrics.length < config.validation.minMetrics) {
      errors.push(new ValidationError(
        `At least ${config.validation.minMetrics} metric must be selected`,
        'metrics',
        'MIN_METRICS'
      ));
    }

    // Validate data quality
    const hasQualityData = config.metrics.every(metric => {
      const metricData = customerMetrics[metric];
      return metricData && metricData.length > 0;
    });

    if (!hasQualityData) {
      errors.push(new ValidationError(
        'Selected metrics have insufficient data',
        'metrics',
        'DATA_QUALITY'
      ));
    }

    setReportState(prev => ({
      ...prev,
      currentReport: config,
      validationErrors: errors
    }));
  }, [customerMetrics]);

  // Handle report mode toggle
  const toggleEditMode = useCallback(() => {
    setReportState(prev => ({
      ...prev,
      isEditing: !prev.isEditing
    }));
  }, []);

  // Generate container classes
  const containerClasses = useMemo(() => {
    return [
      'custom-reports',
      theme.mode === 'high-contrast' ? 'high-contrast' : '',
      className
    ].filter(Boolean).join(' ');
  }, [theme.mode, className]);

  return (
    <ErrorBoundary
      fallback={
        <div role="alert" className="error-container">
          <h2>{t('reports.error.title')}</h2>
          <p>{t('reports.error.message')}</p>
        </div>
      }
    >
      <div 
        className={containerClasses}
        role="main"
        aria-label={t('reports.pageTitle')}
      >
        <header className="reports-header">
          <h1 className="text-2xl font-bold mb-4">
            {t('reports.title')}
          </h1>
          <button
            onClick={toggleEditMode}
            className="edit-mode-toggle"
            aria-pressed={reportState.isEditing}
          >
            {reportState.isEditing ? t('reports.view') : t('reports.edit')}
          </button>
        </header>

        <main className="reports-content">
          {reportState.isEditing ? (
            <ReportBuilder
              initialConfig={reportState.currentReport}
              onConfigChange={handleConfigChange}
              theme={theme}
              validationRules={reportState.currentReport.validation}
            />
          ) : (
            <CustomReport
              config={{
                title: reportState.currentReport.title,
                metrics: reportState.currentReport.metrics,
                period: reportState.currentReport.dateRange.interval.toLowerCase(),
                showTargets: true,
                layout: 'grid'
              }}
              highContrastMode={reportState.currentReport.accessibility.highContrast}
              onMetricClick={(metric, context) => {
                console.log('Metric clicked:', metric, context);
              }}
              aria-label={t('reports.customReport.aria-label')}
            />
          )}
        </main>

        {reportState.validationErrors.length > 0 && (
          <div 
            className="validation-errors"
            role="alert"
            aria-live="polite"
          >
            <h2>{t('reports.validation.title')}</h2>
            <ul>
              {reportState.validationErrors.map((error, index) => (
                <li key={index} className="text-danger">
                  {error.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
});

CustomReports.displayName = 'CustomReports';

export default CustomReports;