import React, { useState, useCallback, useRef, useEffect } from 'react'; // ^18.0.0
import { v4 as uuid } from 'uuid'; // ^9.0.0
import Toast, { ToastProps } from '../components/common/Toast';
import Notification, { NotificationProps } from '../components/common/Notification';
import { useTheme } from './useTheme';
import { useAnalytics } from './useAnalytics';

// Constants for notification management
const DEFAULT_TOAST_DURATION = 5000;
const DEFAULT_TOAST_POSITION = 'top-right';
const MAX_QUEUE_SIZE = 100;
const NOTIFICATION_METRICS_INTERVAL = 60000;

interface NotificationOptions {
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  dismissible?: boolean;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  ariaLabel?: string;
  pauseOnHover?: boolean;
  onDismiss?: () => void;
  onClick?: () => void;
}

interface NotificationState {
  toasts: Map<string, ToastProps>;
  notifications: Map<string, NotificationProps>;
  dismissTimers: Map<string, number>;
  queueSize: number;
  isPaused: boolean;
}

export function useNotification() {
  const { theme } = useTheme();
  const { trackNotification } = useAnalytics();
  const [state, setState] = useState<NotificationState>({
    toasts: new Map(),
    notifications: new Map(),
    dismissTimers: new Map(),
    queueSize: 0,
    isPaused: false
  });

  // Performance monitoring
  const metricsRef = useRef({
    displayCount: 0,
    dismissCount: 0,
    averageDisplayTime: 0
  });

  // Queue management
  const queueRef = useRef<NotificationOptions[]>([]);

  // Clean up function for notification timers
  const cleanupNotification = useCallback((id: string) => {
    setState(prev => {
      const newState = { ...prev };
      const timer = newState.dismissTimers.get(id);
      if (timer) {
        clearTimeout(timer);
        newState.dismissTimers.delete(id);
      }
      newState.toasts.delete(id);
      newState.notifications.delete(id);
      return newState;
    });
  }, []);

  // Process notification queue
  const processQueue = useCallback(() => {
    if (queueRef.current.length > 0 && state.queueSize < MAX_QUEUE_SIZE) {
      const nextNotification = queueRef.current.shift();
      if (nextNotification) {
        const isToast = nextNotification.duration !== undefined;
        if (isToast) {
          showToast(nextNotification);
        } else {
          showNotification(nextNotification);
        }
      }
    }
  }, [state.queueSize]);

  // Show toast notification
  const showToast = useCallback((options: NotificationOptions): string => {
    const id = uuid();
    const duration = options.duration ?? DEFAULT_TOAST_DURATION;
    const position = options.position ?? DEFAULT_TOAST_POSITION;

    if (state.queueSize >= MAX_QUEUE_SIZE) {
      queueRef.current.push(options);
      return id;
    }

    setState(prev => {
      const newState = { ...prev };
      newState.toasts.set(id, {
        id,
        title: options.title,
        message: options.message,
        type: options.type,
        duration,
        dismissible: options.dismissible ?? true,
        position,
        onDismiss: () => {
          cleanupNotification(id);
          options.onDismiss?.();
          trackNotification({
            id,
            type: options.type,
            action: 'dismiss',
            duration: Date.now()
          });
        },
        ariaLive: options.type === 'error' ? 'assertive' : 'polite'
      });
      newState.queueSize++;

      if (duration > 0 && !options.pauseOnHover) {
        newState.dismissTimers.set(id, window.setTimeout(() => {
          cleanupNotification(id);
        }, duration));
      }

      return newState;
    });

    trackNotification({
      id,
      type: options.type,
      action: 'show',
      duration: 0
    });

    return id;
  }, [state.queueSize, cleanupNotification, trackNotification]);

  // Show persistent notification
  const showNotification = useCallback((options: NotificationOptions): string => {
    const id = uuid();

    if (state.queueSize >= MAX_QUEUE_SIZE) {
      queueRef.current.push(options);
      return id;
    }

    setState(prev => {
      const newState = { ...prev };
      newState.notifications.set(id, {
        id,
        title: options.title,
        message: options.message,
        type: options.type,
        dismissible: options.dismissible ?? true,
        position: options.position ?? DEFAULT_TOAST_POSITION,
        onDismiss: () => {
          cleanupNotification(id);
          options.onDismiss?.();
          trackNotification({
            id,
            type: options.type,
            action: 'dismiss',
            duration: Date.now()
          });
        },
        ariaLabel: options.ariaLabel,
        isRTL: theme.mode === 'rtl'
      });
      newState.queueSize++;
      return newState;
    });

    trackNotification({
      id,
      type: options.type,
      action: 'show',
      duration: 0
    });

    return id;
  }, [state.queueSize, cleanupNotification, trackNotification, theme.mode]);

  // Dismiss notification
  const dismissNotification = useCallback((id: string) => {
    cleanupNotification(id);
    processQueue();
  }, [cleanupNotification, processQueue]);

  // Pause all notifications
  const pauseNotifications = useCallback(() => {
    setState(prev => ({ ...prev, isPaused: true }));
    state.dismissTimers.forEach((timer) => {
      clearTimeout(timer);
    });
  }, []);

  // Resume all notifications
  const resumeNotifications = useCallback(() => {
    setState(prev => ({ ...prev, isPaused: false }));
    state.toasts.forEach((toast, id) => {
      if (toast.duration && toast.duration > 0) {
        setState(prev => {
          const newState = { ...prev };
          newState.dismissTimers.set(id, window.setTimeout(() => {
            cleanupNotification(id);
          }, toast.duration!));
          return newState;
        });
      }
    });
  }, [cleanupNotification]);

  // Track notification metrics
  useEffect(() => {
    const interval = setInterval(() => {
      const metrics = metricsRef.current;
      if (metrics.displayCount > 0) {
        trackNotification({
          type: 'metrics',
          displayCount: metrics.displayCount,
          dismissCount: metrics.dismissCount,
          averageDisplayTime: metrics.averageDisplayTime
        });
        // Reset metrics
        metricsRef.current = {
          displayCount: 0,
          dismissCount: 0,
          averageDisplayTime: 0
        };
      }
    }, NOTIFICATION_METRICS_INTERVAL);

    return () => {
      clearInterval(interval);
      // Clean up all notifications on unmount
      state.dismissTimers.forEach(timer => clearTimeout(timer));
    };
  }, [trackNotification]);

  return {
    showToast,
    showNotification,
    dismissNotification,
    pauseNotifications,
    resumeNotifications,
    toasts: Array.from(state.toasts.values()),
    notifications: Array.from(state.notifications.values()),
    isPaused: state.isPaused
  };
}

export default useNotification;