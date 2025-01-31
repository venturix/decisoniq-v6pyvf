import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import classNames from 'classnames'; // ^2.3.0
import Layout from '../components/common/Layout';
import Sidebar from '../components/common/Sidebar';
import KPIOverview from '../components/dashboard/KPIOverview';
import { useTheme } from '../../hooks/useTheme';

// Constants for responsive breakpoints and performance optimization
const DASHBOARD_CLASSES = {
  container: 'flex flex-col gap-6 lg:gap-8',
  kpiSection: 'w-full bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6',
  content: 'flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6',
  highContrast: {
    kpiSection: 'bg-white dark:bg-black border-2 border-black dark:border-white',
    content: 'bg-white dark:bg-black border-2 border-black dark:border-white'
  }
} as const;

const BREAKPOINTS = {
  mobile: 320,
  tablet: 768,
  desktop: 1024,
  large: 1440
} as const;

// Props interface with comprehensive type safety
interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  showKPIs?: boolean;
  refreshInterval?: number;
  highContrast?: boolean;
}

/**
 * Enhanced dashboard layout component with comprehensive feature set
 * Implements responsive design, theme integration, and accessibility support
 * @version 1.0.0
 */
const DashboardLayout = memo<DashboardLayoutProps>(({
  children,
  title,
  subtitle,
  showKPIs = true,
  refreshInterval = 30000,
  highContrast = false
}) => {
  const { theme } = useTheme();
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Handle responsive layout adjustments
  const [isMobile, setIsMobile] = useState(() => 
    typeof window !== 'undefined' ? window.innerWidth < BREAKPOINTS.tablet : false
  );

  // Memoized class computations for performance
  const containerClasses = useMemo(() => 
    classNames(
      DASHBOARD_CLASSES.container,
      {
        'high-contrast': highContrast || theme.mode === 'high-contrast'
      }
    ),
    [highContrast, theme.mode]
  );

  const kpiClasses = useMemo(() => 
    classNames(
      DASHBOARD_CLASSES.kpiSection,
      {
        [DASHBOARD_CLASSES.highContrast.kpiSection]: highContrast || theme.mode === 'high-contrast'
      }
    ),
    [highContrast, theme.mode]
  );

  const contentClasses = useMemo(() => 
    classNames(
      DASHBOARD_CLASSES.content,
      {
        [DASHBOARD_CLASSES.highContrast.content]: highContrast || theme.mode === 'high-contrast'
      }
    ),
    [highContrast, theme.mode]
  );

  // Handle sidebar toggle with animation optimization
  const handleSidebarToggle = useCallback(() => {
    requestAnimationFrame(() => {
      setSidebarCollapsed(prev => !prev);
    });
  }, []);

  // Handle responsive layout
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < BREAKPOINTS.tablet);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize dashboard data
  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        setIsLoading(true);
        // Additional initialization logic would go here
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to initialize dashboard'));
        setIsLoading(false);
      }
    };

    initializeDashboard();
  }, []);

  // Error boundary fallback
  if (error) {
    return (
      <div 
        role="alert"
        className="p-6 m-4 border border-danger rounded-lg bg-surface"
      >
        <h2 className="text-xl font-semibold text-danger">Dashboard Error</h2>
        <p className="mt-2 text-text">{error.message}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-primary text-white rounded"
        >
          Reload Dashboard
        </button>
      </div>
    );
  }

  return (
    <Layout
      title={title}
      subtitle={subtitle}
      showSidebar={true}
      role="main"
      ariaLabel="Dashboard layout"
    >
      <div className={containerClasses}>
        {showKPIs && (
          <section
            className={kpiClasses}
            aria-label="Key Performance Indicators"
          >
            <KPIOverview
              refreshInterval={refreshInterval}
              highContrastMode={highContrast || theme.mode === 'high-contrast'}
              locale={navigator.language}
            />
          </section>
        )}

        <main 
          className={contentClasses}
          role="main"
          aria-busy={isLoading}
        >
          {isLoading ? (
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </Layout>
  );
});

DashboardLayout.displayName = 'DashboardLayout';

export default DashboardLayout;