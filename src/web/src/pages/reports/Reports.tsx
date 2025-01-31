import React, { useCallback, useMemo, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import classNames from 'classnames';

import PageHeader from '../../components/common/PageHeader';
import ReportBuilder from '../../components/reports/ReportBuilder';
import ReportViewer from '../../components/reports/ReportViewer';
import { showNotification } from '../../hooks/useNotification';
import { useTheme } from '../../hooks/useTheme';
import { MetricType, TimeInterval, DataQuality } from '../../types/metrics';
import type { ReportState } from './types';

// Constants for report configuration
const DEFAULT_STATE: ReportState = {
  loading: false,
  error: null,
  reports: [],
  currentReport: null,
  exportProgress: 0,
  lastUpdated: new Date()
};

const NOTIFICATION_MESSAGES = {
  create_success: 'Report created successfully',
  update_success: 'Report updated successfully',
  error: 'An error occurred while processing your request',
  export_start: 'Export started. Please wait...',
  export_complete: 'Export completed successfully',
  validation_error: 'Please check the report configuration'
};

/**
 * Reports page component implementing the Analytics Console interface
 * Provides comprehensive reporting capabilities with enterprise features
 */
const Reports: React.FC = React.memo(() => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { reportId } = useParams<{ reportId: string }>();
  const { theme } = useTheme();

  // Local state management
  const [state, setState] = useState<ReportState>(DEFAULT_STATE);

  // Redux state selectors
  const metrics = useSelector((state: any) => state.metrics);
  const { customerMetrics, aggregateMetrics } = metrics;

  // Memoized report configuration
  const reportConfig = useMemo(() => ({
    metrics: [
      MetricType.CHURN_RATE,
      MetricType.REVENUE_IMPACT,
      MetricType.HEALTH_SCORE,
      MetricType.INTERVENTION_SUCCESS,
      MetricType.OPERATIONAL_EFFICIENCY
    ],
    timeInterval: TimeInterval.MONTHLY,
    visualizations: ['line', 'bar'],
    validation: {
      dataQualityThreshold: DataQuality.HIGH,
      minimumDataPoints: 30
    }
  }), []);

  /**
   * Handles report creation with validation and error handling
   */
  const handleCreateReport = useCallback(async (config: any) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // Validate report configuration
      if (!config.metrics || config.metrics.length === 0) {
        throw new Error('At least one metric must be selected');
      }

      // Create report implementation would go here
      // For now, just simulate success
      await new Promise(resolve => setTimeout(resolve, 1000));

      showNotification({
        title: 'Success',
        message: NOTIFICATION_MESSAGES.create_success,
        type: 'success'
      });

      setState(prev => ({
        ...prev,
        loading: false,
        lastUpdated: new Date()
      }));

      navigate(`/reports/${crypto.randomUUID()}`);
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }));

      showNotification({
        title: 'Error',
        message: error.message || NOTIFICATION_MESSAGES.error,
        type: 'error'
      });
    }
  }, [navigate]);

  /**
   * Handles report update with optimistic updates
   */
  const handleUpdateReport = useCallback(async (reportId: string, config: any) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // Update report implementation would go here
      // For now, just simulate success
      await new Promise(resolve => setTimeout(resolve, 1000));

      showNotification({
        title: 'Success',
        message: NOTIFICATION_MESSAGES.update_success,
        type: 'success'
      });

      setState(prev => ({
        ...prev,
        loading: false,
        lastUpdated: new Date()
      }));
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }));

      showNotification({
        title: 'Error',
        message: error.message || NOTIFICATION_MESSAGES.error,
        type: 'error'
      });
    }
  }, []);

  /**
   * Handles report export with progress tracking
   */
  const handleExport = useCallback(async (format: string, config: any) => {
    try {
      setState(prev => ({ ...prev, exportProgress: 0 }));

      showNotification({
        title: 'Export Started',
        message: NOTIFICATION_MESSAGES.export_start,
        type: 'info'
      });

      // Export implementation would go here
      // For now, just simulate progress
      for (let i = 0; i <= 100; i += 20) {
        await new Promise(resolve => setTimeout(resolve, 500));
        setState(prev => ({ ...prev, exportProgress: i }));
      }

      showNotification({
        title: 'Export Complete',
        message: NOTIFICATION_MESSAGES.export_complete,
        type: 'success'
      });

      setState(prev => ({ ...prev, exportProgress: 0 }));
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        exportProgress: 0,
        error: error.message
      }));

      showNotification({
        title: 'Error',
        message: error.message || NOTIFICATION_MESSAGES.error,
        type: 'error'
      });
    }
  }, []);

  return (
    <div 
      className={classNames(
        'reports-page',
        'p-6',
        'space-y-6',
        theme.mode === 'dark' ? 'bg-gray-900' : 'bg-white'
      )}
    >
      <PageHeader
        title="Analytics & Reports"
        subtitle="Create and manage customer success reports"
        actions={
          !reportId ? (
            <button
              onClick={() => handleCreateReport(reportConfig)}
              disabled={state.loading}
              className="btn-primary"
            >
              Create New Report
            </button>
          ) : null
        }
      />

      {reportId ? (
        <ReportViewer
          reportId={reportId}
          onExport={handleExport}
          theme={theme}
          accessibility={{
            highContrast: theme.mode === 'high-contrast',
            keyboardNavigation: true,
            textSize: 'normal'
          }}
        />
      ) : (
        <ReportBuilder
          initialConfig={reportConfig}
          onConfigChange={handleCreateReport}
          theme={theme}
          validationRules={{
            minMetrics: 1,
            maxMetrics: 5,
            requiredFields: ['title', 'metrics', 'timeInterval']
          }}
        />
      )}
    </div>
  );
});

Reports.displayName = 'Reports';

export default Reports;