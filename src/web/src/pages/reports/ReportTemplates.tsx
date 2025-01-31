import React, { useCallback, useMemo, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import classNames from 'classnames';
import { debounce } from 'lodash';

import ReportBuilder from '../../components/reports/ReportBuilder';
import ReportViewer from '../../components/reports/ReportViewer';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import Card from '../../components/common/Card';
import { useTheme } from '../../hooks/useTheme';
import type { MetricsState } from '../../store/metrics/types';
import { ValidationError } from '../../utils/validation';
import type { MetricType, TimeInterval } from '../../types/metrics';

// Default report templates with predefined metrics and configurations
const DEFAULT_TEMPLATES = [
  {
    id: 'churn-analysis',
    title: 'Churn Analysis Report',
    description: 'Comprehensive analysis of customer churn metrics and trends',
    config: {
      metrics: ['churn_rate', 'revenue_impact'],
      dateRange: { start: '30d', end: 'now' },
      visualizations: ['line', 'pie'],
      accessibility: { highContrast: true, screenReader: true }
    }
  },
  {
    id: 'revenue-impact',
    title: 'Revenue Impact Report',
    description: 'Analysis of revenue impact from customer churn and expansion',
    config: {
      metrics: ['revenue_impact', 'expansion_revenue'],
      dateRange: { start: '90d', end: 'now' },
      visualizations: ['bar', 'line'],
      accessibility: { highContrast: true, screenReader: true }
    }
  }
] as const;

interface ReportTemplate {
  id: string;
  title: string;
  description: string;
  config: ReportConfig;
  createdAt: Date;
  updatedAt: Date;
  permissions: ReportPermissions;
}

interface ReportConfig {
  metrics: MetricType[];
  dateRange: {
    start: string;
    end: string;
  };
  visualizations: string[];
  accessibility: {
    highContrast: boolean;
    screenReader: boolean;
  };
}

interface ReportPermissions {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canShare: boolean;
}

const ReportTemplates: React.FC = React.memo(() => {
  const { theme } = useTheme();
  const dispatch = useDispatch();
  const [activeTemplate, setActiveTemplate] = useState<ReportTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Get metrics data from Redux store
  const { customerMetrics, aggregateMetrics } = useSelector(
    (state: { metrics: MetricsState }) => state.metrics
  );

  // Generate container classes with theme support
  const containerClasses = classNames(
    'report-templates',
    'p-6',
    'space-y-6',
    {
      'theme-light': theme.mode === 'light',
      'theme-dark': theme.mode === 'dark',
      'high-contrast': theme.mode === 'high-contrast'
    }
  );

  // Debounced template update handler
  const handleTemplateUpdate = useCallback(
    debounce(async (template: ReportTemplate) => {
      try {
        // Validate template configuration
        if (!template.config.metrics.length) {
          throw new ValidationError(
            'At least one metric must be selected',
            'metrics',
            'REQUIRED'
          );
        }

        // Update template with optimistic update
        setActiveTemplate(template);

        // Dispatch update action (implementation depends on your state management)
        // dispatch(updateReportTemplate(template));
      } catch (error) {
        console.error('Template update error:', error);
        // Handle error with user notification
      }
    }, 500),
    []
  );

  // Handle template creation with validation
  const handleTemplateCreate = useCallback(async (config: ReportConfig) => {
    try {
      const newTemplate: ReportTemplate = {
        id: `template_${Date.now()}`,
        title: 'New Report Template',
        description: 'Custom report template',
        config,
        createdAt: new Date(),
        updatedAt: new Date(),
        permissions: {
          canView: true,
          canEdit: true,
          canDelete: true,
          canShare: true
        }
      };

      setActiveTemplate(newTemplate);
      setIsEditing(true);

      // Dispatch create action (implementation depends on your state management)
      // dispatch(createReportTemplate(newTemplate));
    } catch (error) {
      console.error('Template creation error:', error);
      // Handle error with user notification
    }
  }, []);

  // Memoized template list with accessibility support
  const templateList = useMemo(() => (
    <div 
      className="template-list grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      role="list"
      aria-label="Report Templates"
    >
      {DEFAULT_TEMPLATES.map(template => (
        <Card
          key={template.id}
          className="template-card cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => setActiveTemplate(template)}
          role="listitem"
          tabIndex={0}
          aria-label={`${template.title} template`}
        >
          <div className="p-4 space-y-2">
            <h3 className="text-lg font-semibold">{template.title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {template.description}
            </p>
            <div className="flex flex-wrap gap-2">
              {template.config.metrics.map(metric => (
                <span
                  key={metric}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-primary-100 text-primary-800"
                >
                  {metric}
                </span>
              ))}
            </div>
          </div>
        </Card>
      ))}
    </div>
  ), []);

  return (
    <ErrorBoundary>
      <div className={containerClasses}>
        <header className="space-y-2">
          <h1 className="text-2xl font-bold">Report Templates</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Create and manage report templates for customer success analytics
          </p>
        </header>

        {/* Template List Section */}
        <section
          className="templates-section"
          aria-labelledby="templates-heading"
        >
          <h2 
            id="templates-heading"
            className="text-xl font-semibold mb-4"
          >
            Available Templates
          </h2>
          {templateList}
        </section>

        {/* Active Template Section */}
        {activeTemplate && (
          <section
            className="active-template-section"
            aria-labelledby="active-template-heading"
          >
            <h2 
              id="active-template-heading"
              className="text-xl font-semibold mb-4"
            >
              {isEditing ? 'Edit Template' : 'View Template'}
            </h2>
            
            {isEditing ? (
              <ReportBuilder
                initialConfig={activeTemplate.config}
                onConfigChange={(config) => 
                  handleTemplateUpdate({
                    ...activeTemplate,
                    config,
                    updatedAt: new Date()
                  })
                }
                theme={theme}
                validationRules={{
                  minMetrics: 1,
                  maxMetrics: 5,
                  requiredVisualizations: true
                }}
              />
            ) : (
              <ReportViewer
                reportId={activeTemplate.id}
                onExport={async (format, config) => {
                  // Implement export functionality
                  console.log('Exporting report:', { format, config });
                }}
                theme={theme}
                accessibility={{
                  highContrast: activeTemplate.config.accessibility.highContrast,
                  keyboardNavigation: true,
                  textSize: 'normal'
                }}
              />
            )}
          </section>
        )}
      </div>
    </ErrorBoundary>
  );
});

ReportTemplates.displayName = 'ReportTemplates';

export default ReportTemplates;