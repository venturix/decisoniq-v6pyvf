import React, { memo, useCallback, useState, useEffect } from 'react';
import classNames from 'classnames'; // ^2.3.0
import { BlitzyUI } from '@blitzy/premium-ui'; // ^2.0.0
import Sidebar from '../components/common/Sidebar';
import PageHeader from '../components/common/PageHeader';
import { useTheme } from '../hooks/useTheme';

// Layout transition timing
const LAYOUT_TRANSITION_DURATION = '200ms';

// Content width constraints
const CONTENT_MAX_WIDTH = '1280px';

// ARIA landmark IDs for accessibility
const ARIA_LANDMARKS = {
  navigation: 'primary-navigation',
  main: 'main-content',
  header: 'page-header',
} as const;

// Enhanced layout classes with theme support
const LAYOUT_CLASSES = {
  container: 'min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 high-contrast:bg-white transition-colors duration-200',
  main: 'flex-1 p-6 lg:p-8 transition-all duration-200 focus-visible:outline-accent-500',
  content: 'max-w-7xl mx-auto',
} as const;

interface MainLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  skipLinkTarget?: string;
}

/**
 * Enhanced main layout component with accessibility and theme support
 * Implements WCAG 2.1 Level AA compliance and responsive design
 * @version 1.0.0
 */
const MainLayout = memo<MainLayoutProps>(({
  children,
  title,
  subtitle,
  actions,
  skipLinkTarget = 'main-content'
}) => {
  // State for sidebar collapse
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { theme } = useTheme();

  // Debounced sidebar toggle handler
  const handleSidebarToggle = useCallback(() => {
    setSidebarCollapsed(prev => !prev);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Toggle sidebar with keyboard shortcut (Ctrl + B)
    if (event.ctrlKey && event.key === 'b') {
      event.preventDefault();
      handleSidebarToggle();
    }
  }, [handleSidebarToggle]);

  // Setup keyboard listeners
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarCollapsed(true);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial check

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div 
      className={classNames(LAYOUT_CLASSES.container)}
      style={{ 
        backgroundColor: theme.colors.background,
        transition: `background-color ${LAYOUT_TRANSITION_DURATION} ease-in-out`
      }}
    >
      {/* Skip to main content link for accessibility */}
      <BlitzyUI.SkipLink
        href={`#${skipLinkTarget}`}
        className="sr-only focus:not-sr-only"
      >
        Skip to main content
      </BlitzyUI.SkipLink>

      {/* Enhanced sidebar with role-based access */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={handleSidebarToggle}
        ariaLabel="Main Navigation"
      />

      {/* Main content area with semantic structure */}
      <main
        id={ARIA_LANDMARKS.main}
        className={classNames(
          LAYOUT_CLASSES.main,
          { 'ml-64': !isSidebarCollapsed, 'ml-16': isSidebarCollapsed }
        )}
        style={{ 
          maxWidth: CONTENT_MAX_WIDTH,
          transition: `margin-left ${LAYOUT_TRANSITION_DURATION} ease-in-out`
        }}
      >
        {/* Enhanced header with theme support */}
        <PageHeader
          title={title}
          subtitle={subtitle}
          actions={actions}
          className="mb-6"
          ariaLabel={ARIA_LANDMARKS.header}
        />

        {/* Main content with max width constraint */}
        <div className={LAYOUT_CLASSES.content}>
          <BlitzyUI.ErrorBoundary
            fallback={<div>Something went wrong. Please try again.</div>}
          >
            {children}
          </BlitzyUI.ErrorBoundary>
        </div>
      </main>

      {/* Status announcer for screen readers */}
      <BlitzyUI.LiveRegion
        aria-live="polite"
        className="sr-only"
      />
    </div>
  );
});

MainLayout.displayName = 'MainLayout';

export default MainLayout;