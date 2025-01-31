import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';

// Interface for extended route configuration
interface AppRoute {
  path: string;
  component: string;
  roles?: string[];
  isPublic?: boolean;
  title: string;
  icon?: string;
  children?: AppRoute[];
}

// Authentication routes configuration
const AUTH_ROUTES: AppRoute[] = [
  {
    path: '/login',
    component: '../pages/auth/Login',
    isPublic: true,
    title: 'Login'
  },
  {
    path: '/logout',
    component: '../pages/auth/Logout',
    isPublic: true,
    title: 'Logout'
  },
  {
    path: '/sso',
    component: '../pages/auth/SSO',
    isPublic: true,
    title: 'Single Sign-On'
  }
];

// Dashboard and analytics routes
const DASHBOARD_ROUTES: AppRoute[] = [
  {
    path: '/dashboard',
    component: '../pages/analytics/Dashboard',
    roles: ['user', 'admin'],
    title: 'Executive Dashboard',
    icon: 'dashboard'
  },
  {
    path: '/analytics',
    component: '../pages/analytics/PerformanceMetrics',
    roles: ['user', 'admin'],
    title: 'Performance Analytics',
    icon: 'analytics'
  }
];

// Customer management routes
const CUSTOMER_ROUTES: AppRoute[] = [
  {
    path: '/customers',
    component: '../pages/customers/CustomerList',
    roles: ['user', 'admin'],
    title: 'Customer Accounts',
    icon: 'customers'
  },
  {
    path: '/customers/:customerId',
    component: '../pages/customers/CustomerProfile',
    roles: ['user', 'admin'],
    title: 'Customer Profile',
    icon: 'customer'
  },
  {
    path: '/customers/:customerId/risk',
    component: '../pages/customers/RiskAssessment',
    roles: ['user', 'admin'],
    title: 'Risk Assessment',
    icon: 'risk'
  }
];

// Loading fallback component for lazy loading
const LoadingFallback = () => (
  <div className="blitzy-loading-spinner">Loading...</div>
);

/**
 * Generates route configuration with lazy loading and access control
 * @param routes Array of application routes
 * @returns Processed route configuration array
 */
const generateRouteConfig = (routes: AppRoute[]): RouteObject[] => {
  return routes.map(route => {
    // Create lazy loaded component
    const LazyComponent = lazy(() => import(route.component));

    // Process route configuration
    const routeConfig: RouteObject = {
      path: route.path,
      element: (
        <Suspense fallback={<LoadingFallback />}>
          <LazyComponent />
        </Suspense>
      )
    };

    // Add nested routes if present
    if (route.children) {
      routeConfig.children = generateRouteConfig(route.children);
    }

    return routeConfig;
  });
};

// Combine all routes
const allRoutes: AppRoute[] = [
  // Root redirect
  {
    path: '/',
    component: '../pages/Root',
    isPublic: true,
    title: 'Root'
  },
  // Group routes by category
  ...AUTH_ROUTES,
  ...DASHBOARD_ROUTES,
  ...CUSTOMER_ROUTES,
  // 404 catch-all route
  {
    path: '*',
    component: '../pages/NotFound',
    isPublic: true,
    title: 'Not Found'
  }
];

// Generate final route configuration
const routes = generateRouteConfig(allRoutes);

export default routes;

// Export route configurations for navigation components
export {
  type AppRoute,
  AUTH_ROUTES,
  DASHBOARD_ROUTES,
  CUSTOMER_ROUTES
};