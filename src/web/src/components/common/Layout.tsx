import React, { memo, useCallback, useEffect, useState } from 'react';
import classNames from 'classnames'; // ^2.3.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0
import { BlitzyUI } from '@blitzy/premium-ui'; // ^2.0.0

import Sidebar from './Sidebar';
import PageHeader from './PageHeader';
import { useTheme } from '../../hooks/useTheme';

// Constants for layout configuration
const LAYOUT_TRANSITION_DURATION = '200ms';
const LAYOUT_CLASSES = {
  container: 'min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 transition-colors duration-200',
  main: 'flex-1 p-6 lg:p-8 transition-all duration-200',
  content: 'max-w-7xl mx-auto',
  highContrast: 'high-contrast-mode',
  accessibleFocus: 'focus-visible:outline-2 focus-visible:outline-offset-2'
} as const;

const CONTENT_MAX_WIDTH = '1280px';
const ARIA_ROLES = {
  main: 'main',
  navigation: 'navigation',
  banner: 'banner'
} as const;

// Error Fallback component with accessibility support
const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
  <div
    role="alert"
    aria-live="assertive"
    className="p-6 m-4 border border-danger rounded-lg bg-surface"
  >
    <h2 className="text-xl font-semibold text-danger">Error</h2>
    <p className="mt-2 text-text">{error.message}</p>
    <BlitzyUI.Button
      onClick={resetErrorBoundary}
      variant="primary"
      className="mt-4"
    >
      Try Again
    </BlitzyUI.Button>
  </div>
);

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  showSidebar?: boolean;
  role?: string;
  ariaLabel?: string;
}

/**
 * Enhanced layout component with accessibility, performance optimizations, and error handling
 * Implements responsive design and theme support following Blitzy Enterprise Design System
 * @version 1.0.0
 */
const Layout = memo<LayoutProps>(({
  children,
  title,
  subtitle,
  actions,
  showSidebar = true,
  role = ARIA_ROLES.main,
  ariaLabel
}) => {
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { theme, currentTheme } = useTheme();

  // Update document title for accessibility
  useEffect(() => {
    document.title = `${title} | Customer Success AI Platform`;
  }, [title]);

  // Handle sidebar toggle with performance optimization
  const handleSidebarToggle = useCallback(() => {
    // Use RAF to ensure smooth animation
    requestAnimationFrame(() => {
      setSidebarCollapsed(prev => !prev);
    });
  }, []);

  // Apply theme-based styles
  const containerClasses = classNames(
    LAYOUT_CLASSES.container,
    {
      [LAYOUT_CLASSES.highContrast]: theme.mode === 'high-contrast',
      'with-sidebar': showSidebar && !isSidebarCollapsed,
      'sidebar-collapsed': showSidebar && isSidebarCollapsed
    }
  );

  const mainClasses = classNames(
    LAYOUT_CLASSES.main,
    LAYOUT_CLASSES.accessibleFocus,
    {
      'ml-sidebar': showSidebar && !isSidebarCollapsed,
      'ml-sidebar-collapsed': showSidebar && isSidebarCollapsed
    }
  );

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => window.location.reload()}
    >
      <div 
        className={containerClasses}
        style={{ 
          backgroundColor: theme.colors.background,
          transition: `background-color ${LAYOUT_TRANSITION_DURATION} ease-in-out`
        }}
      >
        {showSidebar && (
          <Sidebar
            isCollapsed={isSidebarCollapsed}
            onToggle={handleSidebarToggle}
            ariaLabel="Main Navigation"
          />
        )}

        <main
          role={role}
          aria-label={ariaLabel || 'Main content'}
          className={mainClasses}
          style={{ 
            maxWidth: CONTENT_MAX_WIDTH,
            transition: `margin-left ${LAYOUT_TRANSITION_DURATION} ease-in-out`
          }}
        >
          <PageHeader
            title={title}
            subtitle={subtitle}
            actions={actions}
            showBreadcrumbs
            ariaLabel={`${title} page header`}
          />

          <div 
            className={LAYOUT_CLASSES.content}
            style={{ color: theme.colors.text }}
          >
            {children}
          </div>
        </main>

        {/* Skip to main content link for keyboard accessibility */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50"
        >
          Skip to main content
        </a>
      </div>
    </ErrorBoundary>
  );
});

Layout.displayName = 'Layout';

export default Layout;