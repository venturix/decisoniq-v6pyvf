import React, { Suspense, memo } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import {
  BlitzyProvider,
  BlitzyThemeProvider,
  BlitzyAnalytics,
  LoadingFallback
} from '@blitzy/premium-ui'; // ^2.0.0
import { ErrorBoundary } from '@blitzy/error-tracking'; // ^1.0.0
import { PerformanceMonitor } from '@blitzy/performance'; // ^1.0.0

import MainLayout from './layouts/MainLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import routes from './config/routes';

// Configuration constants
const BLITZY_CONFIG = {
  theme: 'enterprise',
  version: '2.0.0',
  features: ['premium-ui', 'sso', 'theme-engine', 'analytics', 'error-tracking', 'performance-monitoring'],
  accessibility: {
    level: 'AA',
    highContrast: true,
    reducedMotion: true
  },
  errorTracking: {
    enabled: true,
    sampleRate: 1.0
  },
  performance: {
    monitoring: true,
    metrics: ['FCP', 'LCP', 'CLS', 'FID']
  }
} as const;

/**
 * Root application component that implements enterprise-grade features
 * Handles routing, authentication, theme management and global layout
 */
const App = memo(() => {
  // Error fallback UI with retry capability
  const ErrorFallback = ({ error, resetErrorBoundary }: any) => (
    <div role="alert" className="error-boundary">
      <h2>Something went wrong</h2>
      <pre>{error.message}</pre>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error) => {
        // Log error to monitoring service
        console.error('Application Error:', error);
      }}
    >
      <PerformanceMonitor
        metrics={BLITZY_CONFIG.performance.metrics}
        sampleRate={BLITZY_CONFIG.errorTracking.sampleRate}
      >
        <BlitzyProvider
          config={BLITZY_CONFIG}
          features={BLITZY_CONFIG.features}
        >
          <BlitzyThemeProvider
            theme={BLITZY_CONFIG.theme}
            accessibility={BLITZY_CONFIG.accessibility}
          >
            <BlitzyAnalytics
              enabled={true}
              sampleRate={1.0}
            >
              <BrowserRouter>
                <Suspense fallback={<LoadingFallback />}>
                  <Routes>
                    {/* Public routes */}
                    <Route path="/login" element={<Navigate to="/auth/login" />} />
                    <Route path="/auth/*" element={<Suspense fallback={<LoadingFallback />}>
                      {routes.find(route => route.path === '/auth/*')?.element}
                    </Suspense>} />

                    {/* Protected routes with MainLayout */}
                    <Route path="/" element={
                      <ProtectedRoute>
                        <MainLayout>
                          <Suspense fallback={<LoadingFallback />}>
                            {routes.find(route => route.path === '/')?.element}
                          </Suspense>
                        </MainLayout>
                      </ProtectedRoute>
                    } />

                    {/* Dashboard routes */}
                    <Route path="/dashboard/*" element={
                      <ProtectedRoute roles={['user', 'admin']}>
                        <MainLayout>
                          <Suspense fallback={<LoadingFallback />}>
                            {routes.find(route => route.path === '/dashboard/*')?.element}
                          </Suspense>
                        </MainLayout>
                      </ProtectedRoute>
                    } />

                    {/* Customer routes */}
                    <Route path="/customers/*" element={
                      <ProtectedRoute roles={['user', 'admin']}>
                        <MainLayout>
                          <Suspense fallback={<LoadingFallback />}>
                            {routes.find(route => route.path === '/customers/*')?.element}
                          </Suspense>
                        </MainLayout>
                      </ProtectedRoute>
                    } />

                    {/* Analytics routes */}
                    <Route path="/analytics/*" element={
                      <ProtectedRoute roles={['user', 'admin']}>
                        <MainLayout>
                          <Suspense fallback={<LoadingFallback />}>
                            {routes.find(route => route.path === '/analytics/*')?.element}
                          </Suspense>
                        </MainLayout>
                      </ProtectedRoute>
                    } />

                    {/* 404 catch-all route */}
                    <Route path="*" element={
                      <MainLayout>
                        <Suspense fallback={<LoadingFallback />}>
                          {routes.find(route => route.path === '*')?.element}
                        </Suspense>
                      </MainLayout>
                    } />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </BlitzyAnalytics>
          </BlitzyThemeProvider>
        </BlitzyProvider>
      </PerformanceMonitor>
    </ErrorBoundary>
  );
});

App.displayName = 'App';

export default App;