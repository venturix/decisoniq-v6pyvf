import React from 'react'; // ^18.0.0
import classNames from 'classnames'; // ^2.3.0
import { Trend, Icon } from '@blitzy/premium-ui'; // ^2.0.0
import Card from '../common/Card';
import { Loading } from '../common/Loading';
import { MetricType, type AggregateMetric, MetricTrend } from '../../types/metrics';
import { useTheme } from '../../lib/blitzy/theme';

interface MetricsCardProps {
  type: MetricType;
  metric: AggregateMetric;
  title: string;
  description?: string;
  loading?: boolean;
  className?: string;
  compact?: boolean;
  showTrendLine?: boolean;
  onClick?: () => void;
}

/**
 * Formats metric value based on type with locale support
 */
const formatMetricValue = (value: number, type: MetricType, locale: string = 'en-US'): string => {
  const formatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });

  switch (type) {
    case MetricType.REVENUE_IMPACT:
    case MetricType.EXPANSION_REVENUE:
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'USD',
        notation: 'compact',
      }).format(value);

    case MetricType.CHURN_RATE:
    case MetricType.RETENTION_RATE:
    case MetricType.CSM_ACTIVATION:
    case MetricType.INTERVENTION_SUCCESS:
      return `${formatter.format(value * 100)}%`;

    case MetricType.HEALTH_SCORE:
    case MetricType.RISK_SCORE:
      return formatter.format(value);

    case MetricType.OPERATIONAL_EFFICIENCY:
      return `${formatter.format(value)}x`;

    default:
      return formatter.format(value);
  }
};

/**
 * Determines trend indicator and color based on metric trend
 */
const getTrendIndicator = (
  trend: MetricTrend,
  type: MetricType,
  highContrastMode: boolean
) => {
  const isInverseMetric = [MetricType.CHURN_RATE, MetricType.RISK_SCORE].includes(type);
  const isImproving = trend === MetricTrend.IMPROVING;
  const isPositive = isInverseMetric ? !isImproving : isImproving;

  return {
    icon: isImproving ? 'trending_up' : trend === MetricTrend.STABLE ? 'trending_flat' : 'trending_down',
    color: highContrastMode
      ? isPositive ? '#000000' : '#000000'
      : isPositive ? 'var(--theme-success)' : 'var(--theme-danger)',
    label: isImproving ? 'Improving' : trend === MetricTrend.STABLE ? 'Stable' : 'Declining',
  };
};

/**
 * A reusable metrics card component that displays key performance indicators
 * and analytics data following the Blitzy Enterprise Design System.
 */
export const MetricsCard: React.FC<MetricsCardProps> = React.memo(({
  type,
  metric,
  title,
  description,
  loading = false,
  className,
  compact = false,
  showTrendLine = true,
  onClick,
}) => {
  const { theme } = useTheme();
  const isHighContrast = theme.mode === 'high-contrast';

  const cardClasses = classNames(
    'metrics-card',
    {
      'metrics-card--compact': compact,
      'metrics-card--interactive': onClick,
    },
    className
  );

  const trendIndicator = getTrendIndicator(metric.trend, type, isHighContrast);
  const percentChange = ((metric.current - metric.previous) / metric.previous) * 100;
  const targetProgress = (metric.current / metric.target) * 100;

  if (loading) {
    return (
      <Card
        variant="default"
        className={cardClasses}
        highContrast={isHighContrast}
      >
        <Loading size="md" text="Loading metric data..." />
      </Card>
    );
  }

  return (
    <Card
      variant="default"
      className={cardClasses}
      onClick={onClick}
      highContrast={isHighContrast}
    >
      <div className="metrics-card__header">
        <h3 className="metrics-card__title" title={title}>
          {title}
        </h3>
        {description && (
          <Icon
            name="info"
            size={16}
            className="metrics-card__info"
            title={description}
            role="tooltip"
          />
        )}
      </div>

      <div className="metrics-card__content">
        <div className="metrics-card__value">
          <span className="metrics-card__current" aria-label="Current value">
            {formatMetricValue(metric.current, type)}
          </span>
          <div 
            className="metrics-card__trend"
            role="status"
            aria-label={`Trend: ${trendIndicator.label}`}
          >
            <Icon
              name={trendIndicator.icon}
              size={16}
              color={trendIndicator.color}
            />
            <span 
              className="metrics-card__change"
              style={{ color: trendIndicator.color }}
            >
              {percentChange >= 0 ? '+' : ''}
              {formatMetricValue(Math.abs(percentChange) / 100, MetricType.RETENTION_RATE)}
            </span>
          </div>
        </div>

        {showTrendLine && (
          <div className="metrics-card__trend-line" aria-hidden="true">
            <Trend
              data={[metric.previous, metric.current]}
              height={compact ? 32 : 48}
              color={trendIndicator.color}
              strokeWidth={2}
              animate
            />
          </div>
        )}

        <div 
          className="metrics-card__target"
          role="progressbar"
          aria-valuenow={targetProgress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="metrics-card__target-label">
            Target: {formatMetricValue(metric.target, type)}
          </div>
          <div className="metrics-card__target-progress">
            <div
              className="metrics-card__target-bar"
              style={{
                width: `${Math.min(targetProgress, 100)}%`,
                backgroundColor: isHighContrast ? '#000000' : 'var(--theme-primary)',
              }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
});

MetricsCard.displayName = 'MetricsCard';

export default MetricsCard;