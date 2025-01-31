import React, { useCallback, useMemo, useState } from 'react'; // ^18.0.0
import { useSelector } from 'react-redux'; // ^8.1.0
import classNames from 'classnames'; // ^2.3.2
import { useTranslation } from 'react-i18next'; // ^22.0.0

import CustomReport from './CustomReport';
import ExportOptions from './ExportOptions';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import type { MetricsState } from '../../store/metrics/types';
import { ValidationError } from '../../utils/validation';

// Constants for viewer configuration
const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
const ANIMATION_DURATION = 300;
const SECURITY_CONFIG = {
  maxFileSize: 50 * 1024 * 1024, // 50MB
  allowedFormats: ['pdf', 'xlsx', 'csv'] as const,
  csrfEnabled: true
} as const;

// Accessibility configuration
const ACCESSIBILITY_CONFIG = {
  ariaLabels: {
    viewer: 'Report viewer',
    zoomControls: 'Zoom controls',
    exportControls: 'Export options',
    errorState: 'Error state',
    loadingState: 'Loading state'
  },
  keyboardShortcuts: {
    zoomIn: 'Ctrl++',
    zoomOut: 'Ctrl+-',
    resetZoom: 'Ctrl+0',
    export: 'Ctrl+E'
  }
} as const;

interface ReportViewerProps {
  reportId: string;
  className?: string;
  onExport?: (format: string, config: ExportConfig) => Promise<void>;
  theme?: ThemeConfig;
  accessibility?: AccessibilityConfig;
}

interface ExportConfig {
  format: typeof SECURITY_CONFIG.allowedFormats[number];
  includeMetadata: boolean;
  dateRange: string;
  compression: boolean;
}

interface ThemeConfig {
  mode: 'light' | 'dark' | 'high-contrast';
  colors: Record<string, string>;
}

interface AccessibilityConfig {
  highContrast?: boolean;
  keyboardNavigation?: boolean;
  textSize?: 'normal' | 'large';
}

const ReportViewer: React.FC<ReportViewerProps> = React.memo(({
  reportId,
  className,
  onExport,
  theme,
  accessibility
}) => {
  const { t } = useTranslation();
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isExporting, setIsExporting] = useState(false);

  // Get metrics data from Redux store
  const metrics = useSelector((state: { metrics: MetricsState }) => state.metrics);
  const { customerMetrics, aggregateMetrics, loading, error } = metrics;

  // Generate report configuration based on metrics data
  const reportConfig = useMemo(() => ({
    title: t('reports.customerSuccess.title'),
    description: t('reports.customerSuccess.description'),
    metrics: [
      'churn_rate',
      'revenue_impact',
      'health_score',
      'intervention_success',
      'operational_efficiency'
    ],
    period: 'monthly',
    showTargets: true,
    layout: 'grid'
  }), [t]);

  // Handle zoom controls with keyboard support
  const handleZoom = useCallback((direction: 'in' | 'out' | 'reset') => {
    setZoomLevel(current => {
      const index = ZOOM_LEVELS.indexOf(current);
      switch (direction) {
        case 'in':
          return ZOOM_LEVELS[Math.min(index + 1, ZOOM_LEVELS.length - 1)] || current;
        case 'out':
          return ZOOM_LEVELS[Math.max(index - 1, 0)] || current;
        case 'reset':
          return 1;
        default:
          return current;
      }
    });
  }, []);

  // Handle export with security validation
  const handleExport = useCallback(async (format: string, config: ExportConfig) => {
    if (!onExport) return;

    try {
      setIsExporting(true);

      // Validate export format and file size
      if (!SECURITY_CONFIG.allowedFormats.includes(format as any)) {
        throw new ValidationError(
          'Invalid export format',
          'format',
          'INVALID_FORMAT'
        );
      }

      await onExport(format, config);
    } catch (error) {
      console.error('Export error:', error);
      throw error;
    } finally {
      setIsExporting(false);
    }
  }, [onExport]);

  // Generate container classes with theme and accessibility support
  const containerClasses = classNames(
    'report-viewer',
    {
      'report-viewer--high-contrast': accessibility?.highContrast || theme?.mode === 'high-contrast',
      'report-viewer--large-text': accessibility?.textSize === 'large',
      'report-viewer--loading': loading,
      'report-viewer--error': error,
      [`report-viewer--theme-${theme?.mode}`]: theme?.mode
    },
    className
  );

  // Setup keyboard event handlers
  React.useEffect(() => {
    if (!accessibility?.keyboardNavigation) return;

    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.ctrlKey) {
        switch (event.key) {
          case '+':
            event.preventDefault();
            handleZoom('in');
            break;
          case '-':
            event.preventDefault();
            handleZoom('out');
            break;
          case '0':
            event.preventDefault();
            handleZoom('reset');
            break;
          case 'e':
            event.preventDefault();
            if (!isExporting) {
              // Open export dialog
            }
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [accessibility?.keyboardNavigation, handleZoom, isExporting]);

  return (
    <ErrorBoundary
      fallback={
        <div role="alert" className="report-viewer__error">
          {t('reports.error.generic')}
        </div>
      }
    >
      <div 
        className={containerClasses}
        role="region"
        aria-label={ACCESSIBILITY_CONFIG.ariaLabels.viewer}
        style={{ transform: `scale(${zoomLevel})` }}
      >
        {/* Zoom Controls */}
        <div 
          className="report-viewer__controls"
          role="toolbar"
          aria-label={ACCESSIBILITY_CONFIG.ariaLabels.zoomControls}
        >
          <button
            onClick={() => handleZoom('out')}
            disabled={zoomLevel === ZOOM_LEVELS[0]}
            aria-label={t('reports.controls.zoomOut')}
          >
            -
          </button>
          <span>{Math.round(zoomLevel * 100)}%</span>
          <button
            onClick={() => handleZoom('in')}
            disabled={zoomLevel === ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
            aria-label={t('reports.controls.zoomIn')}
          >
            +
          </button>
        </div>

        {/* Report Content */}
        <CustomReport
          config={reportConfig}
          className="report-viewer__content"
          aria-label={t('reports.content.label')}
          highContrastMode={accessibility?.highContrast}
        />

        {/* Export Options */}
        <ExportOptions
          onExport={handleExport}
          loading={isExporting}
          disabled={loading || Boolean(error)}
          maxFileSize={SECURITY_CONFIG.maxFileSize}
          onError={(error) => console.error('Export error:', error)}
        />
      </div>
    </ErrorBoundary>
  );
});

ReportViewer.displayName = 'ReportViewer';

export default ReportViewer;
export type { ReportViewerProps, ExportConfig, ThemeConfig, AccessibilityConfig };