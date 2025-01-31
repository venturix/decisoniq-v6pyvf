import React from 'react'; // ^18.0.0
import classNames from 'classnames'; // ^2.3.0
import { Card } from '../common/Card';
import { Loading } from '../common/Loading';
import { useTheme } from '../../lib/blitzy/theme';

/**
 * Props interface for the ChartContainer component
 * Implements comprehensive type safety and accessibility requirements
 */
interface ChartContainerProps {
  /** Chart title displayed in header with proper contrast ratio */
  title: string;
  /** Chart content to be rendered with proper cleanup */
  children: React.ReactNode;
  /** Loading state indicator with overlay support */
  loading?: boolean;
  /** Error message with proper error boundary handling */
  error?: string;
  /** Container height with responsive calculations */
  height?: number;
  /** Additional CSS classes for custom styling */
  className?: string;
}

/**
 * A reusable container component for analytics charts that provides consistent layout,
 * loading states, error handling, and theme support following the Blitzy Enterprise Design System.
 * Implements WCAG 2.1 Level AA compliance for accessibility.
 */
const ChartContainer: React.FC<ChartContainerProps> = React.memo(({
  title,
  children,
  loading = false,
  error,
  height = 300,
  className,
}) => {
  const { theme } = useTheme();

  // Generate container classes with proper theme support
  const containerClasses = classNames(
    'chart-container',
    'relative',
    'w-full',
    {
      'chart-container--loading': loading,
      'chart-container--error': error,
      'chart-container--high-contrast': theme.mode === 'high-contrast',
    },
    className
  );

  // Generate error message classes with proper contrast
  const errorClasses = classNames(
    'chart-container__error',
    'absolute',
    'inset-0',
    'flex',
    'items-center',
    'justify-center',
    'text-danger',
    'bg-surface',
    'bg-opacity-90',
    'p-4',
    'text-center',
    {
      'text-black bg-white': theme.mode === 'high-contrast',
    }
  );

  return (
    <Card
      className={containerClasses}
      variant="default"
      highContrast={theme.mode === 'high-contrast'}
      data-testid="chart-container"
    >
      {/* Chart Header with proper heading hierarchy */}
      <div className="chart-container__header mb-4">
        <h3 
          className="text-lg font-semibold"
          style={{ color: theme.colors.text }}
        >
          {title}
        </h3>
      </div>

      {/* Chart Content with proper dimensions */}
      <div 
        className="chart-container__content relative"
        style={{ height: `${height}px` }}
        role="region"
        aria-label={`Chart: ${title}`}
      >
        {/* Loading State with overlay */}
        {loading && (
          <Loading
            overlay
            size="lg"
            text="Loading chart data..."
            testId="chart-loading"
          />
        )}

        {/* Error State with proper contrast */}
        {error && (
          <div 
            className={errorClasses}
            role="alert"
            aria-live="polite"
          >
            <span>{error}</span>
          </div>
        )}

        {/* Chart Content with error boundary protection */}
        <React.Suspense fallback={<Loading overlay size="lg" />}>
          {!error && children}
        </React.Suspense>
      </div>
    </Card>
  );
});

ChartContainer.displayName = 'ChartContainer';

export default ChartContainer;