import React, { useCallback, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import styled from '@emotion/styled';

import { RiskLevel, type RiskAssessment as RiskAssessmentType } from '../../types/risk';
import { useRisk } from '../../hooks/useRisk';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import Card from '../../components/common/Card';
import Toast from '../../components/common/Toast';
import Button from '../../components/common/Button';
import { useTheme } from '../../lib/blitzy/theme';
import { PERFORMANCE_THRESHOLDS } from '../../config/constants';

// Styled components for layout and visualization
const RiskAssessmentContainer = styled.div`
  display: grid;
  gap: 24px;
  padding: 24px;
  max-width: 1440px;
  margin: 0 auto;

  @media (min-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: 1024px) {
    grid-template-columns: repeat(3, 1fr);
  }
`;

const RiskScoreCard = styled(Card)<{ riskLevel: RiskLevel }>`
  ${({ theme, riskLevel }) => {
    const colors = theme.colors;
    switch (riskLevel) {
      case RiskLevel.CRITICAL:
        return `background-color: ${colors.riskHigh}; color: ${colors.background};`;
      case RiskLevel.HIGH:
        return `background-color: ${colors.warning}; color: ${colors.text};`;
      case RiskLevel.MEDIUM:
        return `background-color: ${colors.info}; color: ${colors.background};`;
      case RiskLevel.LOW:
        return `background-color: ${colors.success}; color: ${colors.background};`;
    }
  }}
`;

const RiskFactorList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const RiskFactorItem = styled.li`
  padding: 16px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  
  &:last-child {
    border-bottom: none;
  }
`;

interface RiskAssessmentPageProps {
  className?: string;
  onError?: (error: Error) => void;
}

const RiskAssessment: React.FC<RiskAssessmentPageProps> = ({
  className,
  onError
}) => {
  // Get customer ID from URL parameters
  const { customerId } = useParams<{ customerId: string }>();
  const { theme } = useTheme();

  // Initialize risk assessment hook with error handling
  const {
    assessment,
    loading,
    error,
    fetchAssessment,
    refresh: retryFetch
  } = useRisk(customerId!, {
    autoRefresh: true,
    refreshInterval: PERFORMANCE_THRESHOLDS.CACHE_TTL,
    enableWebSocket: true
  });

  // Memoized risk level calculation
  const riskLevel = useMemo(() => {
    if (!assessment?.score) return RiskLevel.LOW;
    if (assessment.score >= 90) return RiskLevel.CRITICAL;
    if (assessment.score >= 75) return RiskLevel.HIGH;
    if (assessment.score >= 50) return RiskLevel.MEDIUM;
    return RiskLevel.LOW;
  }, [assessment?.score]);

  // Memoized risk factors with sorting
  const sortedRiskFactors = useMemo(() => {
    if (!assessment?.factors) return [];
    return [...assessment.factors].sort((a, b) => b.impactScore - a.impactScore);
  }, [assessment?.factors]);

  // Handle error display with toast
  const handleError = useCallback((err: Error) => {
    Toast({
      id: `risk_error_${Date.now()}`,
      title: 'Risk Assessment Error',
      message: err.message,
      type: 'error',
      duration: 5000,
      position: 'top-right',
      onDismiss: () => {},
      ariaLive: 'assertive'
    });
    onError?.(err);
  }, [onError]);

  // Initial data fetch
  useEffect(() => {
    if (!customerId) return;

    const fetchData = async () => {
      try {
        await fetchAssessment();
      } catch (err) {
        handleError(err as Error);
      }
    };

    fetchData();

    return () => {
      // Cleanup if needed
    };
  }, [customerId, fetchAssessment, handleError]);

  // Loading state with skeleton UI
  if (loading) {
    return (
      <RiskAssessmentContainer className={className} aria-busy="true">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="loading-skeleton" aria-hidden="true">
            <div className="h-40 animate-pulse bg-gray-200" />
          </Card>
        ))}
      </RiskAssessmentContainer>
    );
  }

  // Error state with retry option
  if (error) {
    return (
      <Card variant="elevated" className={className}>
        <div className="text-center p-6">
          <h2 className="text-xl font-semibold mb-4">Unable to load risk assessment</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button
            variant="primary"
            onClick={() => retryFetch()}
            aria-label="Retry loading risk assessment"
          >
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <ErrorBoundary
      onError={handleError}
      fallback={
        <Card variant="elevated" className="p-6 text-center">
          <h2>Something went wrong</h2>
          <Button onClick={() => window.location.reload()}>Refresh Page</Button>
        </Card>
      }
    >
      <RiskAssessmentContainer className={className}>
        {/* Risk Score Overview */}
        <RiskScoreCard
          variant="elevated"
          riskLevel={riskLevel}
          aria-labelledby="risk-score-title"
        >
          <h2 id="risk-score-title" className="text-2xl font-bold mb-4">
            Risk Score
          </h2>
          <div className="text-4xl font-bold mb-2" aria-live="polite">
            {assessment?.score || 0}
          </div>
          <div className="text-lg" role="status">
            {riskLevel} Risk Level
          </div>
        </RiskScoreCard>

        {/* Risk Factors Breakdown */}
        <Card variant="elevated" aria-labelledby="risk-factors-title">
          <h2 id="risk-factors-title" className="text-xl font-semibold mb-4">
            Risk Factors
          </h2>
          <RiskFactorList role="list">
            {sortedRiskFactors.map((factor) => (
              <RiskFactorItem
                key={factor.category}
                role="listitem"
                aria-label={`${factor.category} risk factor`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">{factor.category}</span>
                  <span className="text-sm">
                    Impact Score: {factor.impactScore}
                  </span>
                </div>
                <p className="text-sm mt-2">{factor.description}</p>
              </RiskFactorItem>
            ))}
          </RiskFactorList>
        </Card>

        {/* Recommendations */}
        <Card variant="elevated" aria-labelledby="recommendations-title">
          <h2 id="recommendations-title" className="text-xl font-semibold mb-4">
            Recommendations
          </h2>
          {assessment?.recommendations && (
            <div className="space-y-4">
              {Object.entries(assessment.recommendations).map(([key, value]) => (
                <div key={key} className="p-4 bg-surface rounded">
                  <h3 className="font-medium mb-2">{key}</h3>
                  <p className="text-sm">{String(value)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </RiskAssessmentContainer>
    </ErrorBoundary>
  );
};

export default React.memo(RiskAssessment);