/**
 * Redux store configuration for the Customer Success AI Platform
 * Implements production-ready state management with performance optimization
 * @version 1.0.0
 * @package @customer-success-ai/web
 */

// External imports with strict versioning
import { configureStore } from '@reduxjs/toolkit'; // ^1.9.5
import thunk from 'redux-thunk'; // ^2.4.2
import logger from 'redux-logger'; // ^3.0.6

// Internal imports
import rootReducer, { RootState, RootAction } from './rootReducer';

// Constants
const PERFORMANCE_THRESHOLD_MS = 3000; // 3s performance target
const STATE_VERSION = '1.0';
const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Performance monitoring middleware for tracking state update times
 */
const performanceMiddleware = () => (next: any) => (action: RootAction) => {
  const start = performance.now();
  const result = next(action);
  const duration = performance.now() - start;

  if (duration > PERFORMANCE_THRESHOLD_MS) {
    console.warn(`Action ${action.type} took ${duration}ms to process`);
  }

  return result;
};

/**
 * Security middleware for state sanitization and validation
 */
const securityMiddleware = () => (next: any) => (action: RootAction) => {
  // Validate action structure
  if (!action || typeof action.type !== 'string') {
    console.error('Invalid action structure detected');
    return next(action);
  }

  // Prevent prototype pollution
  if (action.type.includes('__proto__') || action.type.includes('constructor')) {
    console.error('Potential prototype pollution attempt detected');
    return next({ type: 'INVALID_ACTION' });
  }

  return next(action);
};

/**
 * Error boundary middleware for comprehensive error tracking
 */
const errorBoundaryMiddleware = () => (next: any) => (action: RootAction) => {
  try {
    return next(action);
  } catch (error) {
    console.error('Error in reducer for action:', action.type, error);
    // Log to error tracking service
    return next({
      type: 'ERROR_BOUNDARY_CAUGHT',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Audit logging middleware for security tracking
 */
const auditMiddleware = () => (next: any) => (action: RootAction) => {
  const result = next(action);
  
  // Log security-relevant actions
  if (action.type.includes('auth/') || action.type.includes('risk/')) {
    const auditLog = {
      action: action.type,
      timestamp: new Date().toISOString(),
      metadata: { ...action, type: undefined }
    };
    // Send to audit logging service
    console.info('Audit log:', auditLog);
  }

  return result;
};

/**
 * Configure Redux store with optimized middleware stack and security measures
 */
const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => {
    const middleware = getDefaultMiddleware({
      serializableCheck: {
        // Ignore certain paths for non-serializable data
        ignoredActions: ['auth/LOGIN_SUCCESS', 'metrics/UPDATE_TIME_RANGE'],
        ignoredPaths: ['auth.user', 'metrics.timeRange']
      },
      thunk: true,
      immutableCheck: true
    }).concat([
      performanceMiddleware,
      securityMiddleware,
      errorBoundaryMiddleware,
      auditMiddleware
    ]);

    // Add logger in development only
    if (isDevelopment) {
      middleware.push(logger);
    }

    return middleware;
  },
  devTools: isDevelopment ? {
    name: 'Customer Success AI Platform',
    maxAge: 50,
    trace: true,
    traceLimit: 25,
    serialize: {
      options: {
        undefined: true,
        function: false
      }
    }
  } : false,
  preloadedState: undefined,
  enhancers: []
});

// Type-safe dispatch
export type AppDispatch = typeof store.dispatch;

// Export configured store
export default store;

/**
 * Type guard to ensure state version compatibility
 */
export function isCompatibleState(state: unknown): state is RootState {
  return (
    typeof state === 'object' &&
    state !== null &&
    'version' in state &&
    (state as any).version === STATE_VERSION
  );
}