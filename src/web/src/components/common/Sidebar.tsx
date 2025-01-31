import React, { memo, useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import classNames from 'classnames';
import { DASHBOARD_ROUTES, CUSTOMER_ROUTES } from '../../config/routes';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';

// Constants for sidebar dimensions and animations
const SIDEBAR_WIDTH = 280;
const SIDEBAR_COLLAPSED_WIDTH = 64;
const TRANSITION_DURATION = '300ms';
const RESIZE_DEBOUNCE_DELAY = 150;

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  ariaLabel?: string;
}

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles?: string[];
  requiredPermissions?: string[];
}

/**
 * Enhanced sidebar navigation component with security and accessibility features
 * Implements Blitzy Enterprise Design System patterns
 * @version 1.0.0
 */
const Sidebar = memo(({ isCollapsed, onToggle, ariaLabel = 'Main Navigation' }: SidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, validateAccess } = useAuth();
  const { theme, currentTheme } = useTheme();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Combine and process navigation routes
  const navigationItems = React.useMemo(() => {
    const allRoutes = [...DASHBOARD_ROUTES, ...CUSTOMER_ROUTES]
      .filter(route => !route.isPublic)
      .map(route => ({
        label: route.title,
        path: route.path,
        icon: route.icon,
        roles: route.roles
      }));

    return allRoutes.filter(item => 
      item.roles ? validateAccess(item.roles) : true
    );
  }, [validateAccess]);

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
    };

    let resizeTimer: NodeJS.Timeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(handleResize, RESIZE_DEBOUNCE_DELAY);
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
    };
  }, []);

  // Enhanced navigation handler with security validation
  const handleNavigation = useCallback((path: string) => {
    if (!user) {
      navigate('/login');
      return;
    }
    navigate(path);
  }, [navigate, user]);

  // Active route checker with path validation
  const isNavItemActive = useCallback((path: string): boolean => {
    const currentPath = location.pathname;
    if (path === '/') {
      return currentPath === path;
    }
    return currentPath.startsWith(path);
  }, [location]);

  // Keyboard navigation handler
  const handleKeyPress = useCallback((event: React.KeyboardEvent, path: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleNavigation(path);
    }
  }, [handleNavigation]);

  return (
    <nav
      aria-label={ariaLabel}
      className={classNames(
        'sidebar',
        'fixed h-full bg-surface shadow-lg transition-all duration-300 ease-in-out',
        {
          'w-sidebar': !isCollapsed,
          'w-sidebar-collapsed': isCollapsed,
          'translate-x-0': !isMobile || !isCollapsed,
          '-translate-x-full': isMobile && isCollapsed
        }
      )}
      style={{
        width: isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
        transition: `width ${TRANSITION_DURATION} ease-in-out`,
        backgroundColor: theme.colors.navigation.bg
      }}
    >
      {/* Logo and Toggle Section */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-border">
        <div className={classNames('transition-opacity duration-200', {
          'opacity-0 w-0': isCollapsed,
          'opacity-100': !isCollapsed
        })}>
          <img
            src="/logo.svg"
            alt="Customer Success AI Platform"
            className="h-8"
          />
        </div>
        <button
          onClick={onToggle}
          aria-label={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          className="p-2 rounded hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <svg
            className={`w-6 h-6 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d={isCollapsed ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'}
            />
          </svg>
        </button>
      </div>

      {/* Navigation Items */}
      <div className="py-4 overflow-y-auto">
        {navigationItems.map((item) => (
          <div
            key={item.path}
            onClick={() => handleNavigation(item.path)}
            onKeyPress={(e) => handleKeyPress(e, item.path)}
            role="button"
            tabIndex={0}
            aria-current={isNavItemActive(item.path) ? 'page' : undefined}
            className={classNames(
              'flex items-center px-4 py-2 my-1 cursor-pointer transition-colors duration-200',
              {
                'bg-navigation-itemActive text-navigation-itemTextHover': isNavItemActive(item.path),
                'hover:bg-navigation-itemHover': !isNavItemActive(item.path)
              }
            )}
          >
            <span className="w-6 h-6">{item.icon}</span>
            <span
              className={classNames('ml-3 text-sm font-medium transition-opacity duration-200', {
                'opacity-0 w-0': isCollapsed,
                'opacity-100': !isCollapsed
              })}
              style={{ color: theme.colors.navigation.itemText }}
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* User Section */}
      {user && (
        <div className="absolute bottom-0 w-full p-4 border-t border-border">
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-primary">
              <span className="flex items-center justify-center h-full text-white">
                {user.firstName[0]}
              </span>
            </div>
            <div
              className={classNames('ml-3 transition-opacity duration-200', {
                'opacity-0 w-0': isCollapsed,
                'opacity-100': !isCollapsed
              })}
            >
              <p className="text-sm font-medium text-text">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-textSecondary">{user.roles[0]}</p>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;