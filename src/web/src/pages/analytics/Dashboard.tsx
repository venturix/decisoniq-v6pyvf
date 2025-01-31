import React, { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import KPIOverview from '../../components/dashboard/KPIOverview';
import ActivityFeed from '../../components/dashboard/ActivityFeed';
import QuickActions from '../../components/dashboard/QuickActions';
import RecentAlerts from '../../components/dashboard/RecentAlerts';
import PageHeader from '../../components/common/PageHeader';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import { useTheme } from '../../hooks/useTheme';
import { PERFORMANCE_THRESHOLDS } from '../../config/constants';

interface DashboardProps {
  className?: string;
  userRole: string;
  refreshIntervals?: {
    kpi: number;
    activities: number;
    alerts: number;
  };
}

const DEFAULT_REFRESH_INTERVALS = {
  kpi: 300000, // 5 minutes
  activities: 30000, // 30 seconds
  alerts: 60000 // 1 minute
};

const Dashboard: React.FC<DashboardProps> = React.memo(({
  className,
  userRole,
  refreshIntervals = DEFAULT_REFRESH_INTERVALS
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();

  // Performance monitoring
  const startTime = useRef(performance.now());

  // Monitor initial load performance
  useEffect(() => {
    const loadTime = performance.now() - startTime.current;
    if (loadTime > PERFORMANCE_THRESHOLDS.PAGE_LOAD_TIME) {
      console.warn(`Dashboard load time exceeded threshold: ${loadTime}ms`);
    }
  }, []);

  // Handle alert clicks
  const handleAlertClick = useCallback((alert: any) => {
    // Navigate to customer details or handle alert action
    console.log('Alert clicked:', alert);
  }, []);

  // Handle error reporting
  const handleError = useCallback((error: Error) => {
    console.error('Dashboard error:', error);
  }, []);

  return (
    <ErrorBoundary
      onError={handleError}
      fallback={
        <div className="p-6 text-center text-error">
          {t('dashboard.errorLoading')}
        </div>
      }
    >
      <div 
        className={`min-h-screen bg-background dark:bg-background-dark ${className}`}
        role="main"
        aria-label={t('dashboard.mainContent')}
      >
        <PageHeader
          title={t('dashboard.title')}
          subtitle={t('dashboard.subtitle')}
          className="mb-6"
        />

        <div className="p-6 space-y-6">
          {/* KPI Overview Section */}
          <section aria-label={t('dashboard.kpiSection')}>
            <ErrorBoundary>
              <KPIOverview
                refreshInterval={refreshIntervals.kpi}
                highContrastMode={theme.mode === 'high-contrast'}
                className="mb-6"
              />
            </ErrorBoundary>
          </section>

          {/* Quick Actions Section */}
          <section aria-label={t('dashboard.quickActionsSection')}>
            <ErrorBoundary>
              <QuickActions className="mb-6" />
            </ErrorBoundary>
          </section>

          {/* Main Dashboard Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Activity Feed */}
            <section aria-label={t('dashboard.activitySection')}>
              <ErrorBoundary>
                <ActivityFeed
                  maxItems={10}
                  refreshInterval={refreshIntervals.activities}
                  className="h-full"
                />
              </ErrorBoundary>
            </section>

            {/* Recent Alerts */}
            <section aria-label={t('dashboard.alertsSection')}>
              <ErrorBoundary>
                <RecentAlerts
                  maxAlerts={5}
                  refreshInterval={refreshIntervals.alerts}
                  onAlertClick={handleAlertClick}
                  className="h-full"
                />
              </ErrorBoundary>
            </section>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
});

Dashboard.displayName = 'Dashboard';

export default Dashboard;