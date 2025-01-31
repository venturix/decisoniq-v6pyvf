import React from 'react'; // ^18.0.0
import classNames from 'classnames'; // ^2.3.0
import type { Customer } from '../../types/customer';
import Card from '../common/Card';
import { useCustomer } from '../../hooks/useCustomer';

/**
 * Props interface for CustomerHealthScore component with enhanced configuration options
 */
interface CustomerHealthScoreProps {
  customerId: string;
  refreshInterval?: number;
  showTrend?: boolean;
  className?: string;
  theme?: 'light' | 'dark' | 'high-contrast';
  onError?: (error: Error) => void;
}

/**
 * Determines semantic color coding for health score display with theme and accessibility support
 */
const getHealthScoreColor = (score: number, theme: string): string => {
  const baseClasses = 'font-semibold text-lg';
  
  if (score >= 80) {
    return classNames(baseClasses, {
      'text-success dark:text-successLight': theme === 'dark',
      'text-success': theme === 'light',
      'text-black bg-white border-2 border-black': theme === 'high-contrast'
    });
  } else if (score >= 60) {
    return classNames(baseClasses, {
      'text-warning dark:text-warningLight': theme === 'dark',
      'text-warning': theme === 'light',
      'text-black bg-white border-2 border-black': theme === 'high-contrast'
    });
  } else {
    return classNames(baseClasses, {
      'text-danger dark:text-errorLight': theme === 'dark',
      'text-danger': theme === 'light',
      'text-black bg-white border-2 border-black': theme === 'high-contrast'
    });
  }
};

/**
 * Calculates trend direction with enhanced historical analysis
 */
const getHealthScoreTrend = (metadata: Customer['metadata']): string => {
  const historicalScores = metadata.usageMetrics.featureAdoption;
  const currentScore = Object.values(historicalScores).reduce((a, b) => a + b, 0) / Object.keys(historicalScores).length;
  const previousScore = currentScore - (metadata.usageMetrics.apiUsage / 100);

  if (currentScore > previousScore + 5) {
    return '↑';
  } else if (currentScore < previousScore - 5) {
    return '↓';
  }
  return '→';
};

/**
 * Enhanced component for displaying customer health score with real-time updates and accessibility features
 */
export const CustomerHealthScore: React.FC<CustomerHealthScoreProps> = React.memo(({
  customerId,
  refreshInterval = 30000,
  showTrend = true,
  className,
  theme = 'light',
  onError
}) => {
  const {
    selectedCustomer,
    healthScore,
    refreshHealthScore,
    isLoading,
    error
  } = useCustomer({
    refreshInterval,
    autoLoad: true
  });

  // Handle errors with error boundary pattern
  React.useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  // Setup refresh interval
  React.useEffect(() => {
    const intervalId = setInterval(() => {
      refreshHealthScore(customerId);
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [customerId, refreshInterval, refreshHealthScore]);

  // Memoize color class calculation
  const colorClass = React.useMemo(() => 
    getHealthScoreColor(healthScore || 0, theme),
    [healthScore, theme]
  );

  // Memoize trend calculation when enabled
  const trend = React.useMemo(() => 
    showTrend && selectedCustomer ? getHealthScoreTrend(selectedCustomer.metadata) : null,
    [showTrend, selectedCustomer]
  );

  if (isLoading) {
    return (
      <Card
        variant="default"
        className={classNames('animate-pulse', className)}
        theme={{ mode: theme }}
      >
        <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card
        variant="outlined"
        className={classNames('border-danger', className)}
        theme={{ mode: theme }}
      >
        <div role="alert" className="text-danger dark:text-errorLight">
          Failed to load health score
        </div>
      </Card>
    );
  }

  return (
    <Card
      variant="default"
      className={classNames('p-4', className)}
      theme={{ mode: theme }}
    >
      <div className="flex flex-col items-center justify-center">
        <div className="text-sm text-textSecondary dark:text-textSecondary mb-2">
          Customer Health Score
        </div>
        <div
          className={colorClass}
          role="status"
          aria-label={`Health Score: ${healthScore}`}
          aria-live="polite"
        >
          {healthScore}%
          {showTrend && trend && (
            <span 
              className="ml-2" 
              role="img" 
              aria-label={`Trend: ${trend === '↑' ? 'Improving' : trend === '↓' ? 'Declining' : 'Stable'}`}
            >
              {trend}
            </span>
          )}
        </div>
        <div className="mt-2 text-xs text-textSecondary dark:text-textSecondary">
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>
    </Card>
  );
});

CustomerHealthScore.displayName = 'CustomerHealthScore';

export default CustomerHealthScore;