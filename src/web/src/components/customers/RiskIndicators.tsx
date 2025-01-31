import React from 'react'; // ^18.0.0
import classNames from 'classnames'; // ^2.3.0
import Card from '../common/Card';
import Badge from '../common/Badge';
import { useTheme } from '../../hooks/useTheme';
import { RiskLevel, type RiskScore, type RiskFactor } from '../../types/risk';

/**
 * Props interface for RiskIndicators component with enhanced accessibility and theme options
 */
interface RiskIndicatorsProps {
  /** Current risk score data */
  riskScore: RiskScore;
  /** Optional CSS class name */
  className?: string;
  /** Enable high contrast mode for accessibility */
  highContrast?: boolean;
  /** Optional callback for risk factor interaction */
  onRiskFactorClick?: (factor: RiskFactor) => void;
  /** Accessibility label for screen readers */
  ariaLabel?: string;
}

/**
 * Determines badge variant based on risk level with theme consideration
 */
const getRiskBadgeVariant = (level: RiskLevel, highContrast: boolean): string => {
  const variantMap: Record<RiskLevel, string> = {
    [RiskLevel.LOW]: 'success',
    [RiskLevel.MEDIUM]: 'warning',
    [RiskLevel.HIGH]: 'error',
    [RiskLevel.CRITICAL]: 'error'
  };
  return highContrast ? 'default' : variantMap[level];
};

/**
 * Generates accessible text label for risk levels
 */
const getRiskLevelLabel = (level: RiskLevel): string => {
  const labelMap: Record<RiskLevel, string> = {
    [RiskLevel.LOW]: 'Low Risk',
    [RiskLevel.MEDIUM]: 'Medium Risk',
    [RiskLevel.HIGH]: 'High Risk',
    [RiskLevel.CRITICAL]: 'Critical Risk'
  };
  return labelMap[level];
};

/**
 * Enhanced component for displaying customer risk indicators with accessibility and theme support
 */
export const RiskIndicators: React.FC<RiskIndicatorsProps> = React.memo(({
  riskScore,
  className,
  highContrast = false,
  onRiskFactorClick,
  ariaLabel = 'Customer Risk Assessment'
}) => {
  const { theme } = useTheme();

  // Render risk level badge with accessibility features
  const renderRiskLevel = () => (
    <div className="flex items-center gap-2 mb-4">
      <Badge
        variant={getRiskBadgeVariant(riskScore.level, highContrast)}
        size="lg"
        className={classNames(
          'font-semibold',
          { 'border-2 border-current': highContrast }
        )}
        role="status"
        ariaLabel={getRiskLevelLabel(riskScore.level)}
      >
        <span className="mr-2">{getRiskLevelLabel(riskScore.level)}</span>
        <span className="text-sm">
          {riskScore.score.toFixed(0)}%
        </span>
      </Badge>
    </div>
  );

  // Render risk factors with interactive elements
  const renderRiskFactors = () => (
    <div className="space-y-3">
      {riskScore.factors.map((factor, index) => (
        <div
          key={`${factor.category}-${index}`}
          className={classNames(
            'p-3 rounded-md transition-colors',
            {
              'cursor-pointer hover:bg-surface': !!onRiskFactorClick,
              'border-2 border-current': highContrast
            }
          )}
          onClick={() => onRiskFactorClick?.(factor)}
          role="button"
          tabIndex={0}
          aria-label={`Risk factor: ${factor.category}`}
        >
          <div className="flex justify-between items-center">
            <span className="font-medium capitalize">
              {factor.category}
            </span>
            <Badge
              variant={factor.impactScore > 75 ? 'error' : 'warning'}
              size="sm"
              className={classNames({
                'border border-current': highContrast
              })}
            >
              {factor.impactScore.toFixed(0)}%
            </Badge>
          </div>
          <p className="text-sm text-textSecondary mt-1">
            {factor.description}
          </p>
        </div>
      ))}
    </div>
  );

  return (
    <Card
      variant="elevated"
      className={classNames(
        'risk-indicators',
        { 'high-contrast': highContrast },
        className
      )}
      highContrast={highContrast}
    >
      <div
        role="region"
        aria-label={ariaLabel}
        className="p-4"
      >
        {renderRiskLevel()}
        {renderRiskFactors()}
      </div>
    </Card>
  );
});

RiskIndicators.displayName = 'RiskIndicators';

export default RiskIndicators;