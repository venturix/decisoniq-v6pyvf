import React from 'react';
import { useQuery } from '@tanstack/react-query'; // ^4.0.0
import { useVirtualizer } from '@tanstack/react-virtual'; // ^3.0.0
import { useRBAC } from '@auth/rbac'; // ^1.0.0
import styled from '@emotion/styled'; // ^11.0.0

import Card from '../common/Card';
import Button from '../common/Button';
import ErrorBoundary from '../common/ErrorBoundary';
import Toast from '../common/Toast';
import { useTheme } from '../../hooks/useTheme';
import { getHighRiskCustomers } from '../../lib/api/risk';
import type { Customer } from '../../types/customer';
import { RiskLevel } from '../../types/risk';

// Props interface for the RecentAlerts component
interface RecentAlertsProps {
  maxAlerts?: number;
  refreshInterval?: number;
  className?: string;
  onAlertClick?: (alert: AlertItem) => void;
}

// Interface for individual alert items
interface AlertItem {
  id: string;
  customerId: string;
  customerName: string;
  riskLevel: RiskLevel;
  timestamp: Date;
  riskFactors: string[];
}

// Styled components for alert visualization
const AlertContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
`;

const AlertItemContainer = styled.div<{ riskLevel: RiskLevel }>`
  display: flex;
  align-items: center;
  padding: 12px;
  border-radius: 6px;
  background: ${({ theme, riskLevel }) => {
    switch (riskLevel) {
      case RiskLevel.CRITICAL:
        return theme.colors.riskHigh;
      case RiskLevel.HIGH:
        return theme.colors.riskHighBg;
      case RiskLevel.MEDIUM:
        return theme.colors.riskMediumBg;
      default:
        return theme.colors.surface;
    }
  }};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    transform: translateX(4px);
  }
`;

const AlertContent = styled.div`
  flex: 1;
`;

const AlertHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
`;

const CustomerName = styled.span`
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

const Timestamp = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const RiskFactors = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const RiskFactor = styled.span`
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 12px;
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

// Format customer data into alert items
const formatAlertData = (customers: Customer[]): AlertItem[] => {
  return customers
    .filter(customer => customer.riskProfile.level === RiskLevel.HIGH || 
                       customer.riskProfile.level === RiskLevel.CRITICAL)
    .map(customer => ({
      id: `${customer.id}-${Date.now()}`,
      customerId: customer.id,
      customerName: customer.name,
      riskLevel: customer.riskProfile.level,
      timestamp: new Date(customer.riskProfile.lastAssessment),
      riskFactors: customer.riskProfile.factors.map(f => f.name)
    }))
    .sort((a, b) => {
      // Sort by risk level first, then by timestamp
      if (a.riskLevel === b.riskLevel) {
        return b.timestamp.getTime() - a.timestamp.getTime();
      }
      return a.riskLevel === RiskLevel.CRITICAL ? -1 : 1;
    });
};

const RecentAlerts: React.FC<RecentAlertsProps> = ({
  maxAlerts = 5,
  refreshInterval = 30000,
  className,
  onAlertClick
}) => {
  const { theme } = useTheme();
  const { hasPermission } = useRBAC();
  const parentRef = React.useRef<HTMLDivElement>(null);

  // Fetch high-risk customers with automatic refresh
  const { data, isLoading, error, refetch } = useQuery(
    ['highRiskCustomers'],
    () => getHighRiskCustomers({ page: 1, pageSize: maxAlerts }),
    {
      refetchInterval: refreshInterval,
      refetchOnWindowFocus: true,
      staleTime: refreshInterval / 2,
      retry: 3,
      onError: (err) => {
        Toast({
          id: 'alert-fetch-error',
          type: 'error',
          title: 'Error fetching alerts',
          message: 'Unable to load recent alerts. Please try again.',
          duration: 5000
        });
      }
    }
  );

  // Virtual list for performance optimization
  const rowVirtualizer = useVirtualizer({
    count: data?.data?.length ?? 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5
  });

  // Check user permissions
  if (!hasPermission('VIEW_ALERTS')) {
    return null;
  }

  const alerts = data?.data ? formatAlertData(data.data) : [];

  return (
    <ErrorBoundary
      fallback={
        <Card variant="outlined" className={className}>
          <div>Error loading alerts</div>
        </Card>
      }
    >
      <Card
        variant="elevated"
        className={className}
        data-testid="recent-alerts"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Recent Alerts</h2>
          <Button
            variant="secondary"
            size="small"
            onClick={() => refetch()}
            loading={isLoading}
            aria-label="Refresh alerts"
          >
            Refresh
          </Button>
        </div>

        <AlertContainer ref={parentRef}>
          {isLoading ? (
            <div className="animate-pulse">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-20 bg-gray-200 rounded-lg mb-2"
                  aria-hidden="true"
                />
              ))}
            </div>
          ) : alerts.length > 0 ? (
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative'
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const alert = alerts[virtualRow.index];
                return (
                  <AlertItemContainer
                    key={alert.id}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`
                    }}
                    riskLevel={alert.riskLevel}
                    onClick={() => onAlertClick?.(alert)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Alert for ${alert.customerName}`}
                  >
                    <AlertContent>
                      <AlertHeader>
                        <CustomerName>{alert.customerName}</CustomerName>
                        <Timestamp>
                          {alert.timestamp.toLocaleString()}
                        </Timestamp>
                      </AlertHeader>
                      <RiskFactors>
                        {alert.riskFactors.map((factor, index) => (
                          <RiskFactor key={index}>{factor}</RiskFactor>
                        ))}
                      </RiskFactors>
                    </AlertContent>
                  </AlertItemContainer>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No high-risk alerts at this time
            </div>
          )}
        </AlertContainer>
      </Card>
    </ErrorBoundary>
  );
};

export default React.memo(RecentAlerts);