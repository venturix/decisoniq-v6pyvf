import React, { useEffect, useCallback } from 'react';
import styled from '@emotion/styled';
import { AnimatePresence, motion } from 'framer-motion';
import classNames from 'classnames';
import { useTheme } from '../../hooks/useTheme';
import Button from './Button';
import { useAnalytics } from '../../hooks/useAnalytics';

interface NotificationProps {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  dismissible?: boolean;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  onDismiss: () => void;
  icon?: React.ReactNode;
  priority?: number;
  isRTL?: boolean;
  customAnimation?: AnimationConfig;
}

interface AnimationConfig {
  initial?: Record<string, any>;
  animate?: Record<string, any>;
  exit?: Record<string, any>;
}

const defaultAnimation = {
  initial: { opacity: 0, y: -20, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { 
    opacity: 0, 
    scale: 0.95, 
    transition: { duration: 0.2 } 
  }
};

const StyledNotification = styled(motion.div)<{
  type: NotificationProps['type'];
  position: NonNullable<NotificationProps['position']>;
  isRTL: boolean;
  highContrast: boolean;
}>`
  position: fixed;
  display: flex;
  align-items: flex-start;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 320px;
  max-width: 480px;
  z-index: 1000;
  direction: ${props => props.isRTL ? 'rtl' : 'ltr'};

  ${props => {
    const { theme, type, highContrast } = props;
    const baseStyles = `
      background: ${theme.colors.background};
      border: 1px solid ${theme.colors[type]};
    `;

    switch (type) {
      case 'success':
        return `
          ${baseStyles}
          border-left: 4px solid ${highContrast ? theme.colors.successLight : theme.colors.success};
          color: ${theme.colors.success};
        `;
      case 'error':
        return `
          ${baseStyles}
          border-left: 4px solid ${highContrast ? theme.colors.errorLight : theme.colors.error};
          color: ${theme.colors.error};
        `;
      case 'warning':
        return `
          ${baseStyles}
          border-left: 4px solid ${highContrast ? theme.colors.warningLight : theme.colors.warning};
          color: ${theme.colors.warning};
        `;
      case 'info':
        return `
          ${baseStyles}
          border-left: 4px solid ${highContrast ? theme.colors.infoLight : theme.colors.info};
          color: ${theme.colors.info};
        `;
    }
  }}

  ${props => {
    switch (props.position) {
      case 'top-right':
        return 'top: 20px; right: 20px;';
      case 'top-left':
        return 'top: 20px; left: 20px;';
      case 'bottom-right':
        return 'bottom: 20px; right: 20px;';
      case 'bottom-left':
        return 'bottom: 20px; left: 20px;';
    }
  }}
`;

const NotificationContent = styled.div`
  flex: 1;
  margin: ${props => props.theme.isRTL ? '0 0 0 12px' : '0 12px 0 0'};
`;

const NotificationTitle = styled.h4`
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
  color: ${props => props.theme.colors.text};
`;

const NotificationMessage = styled.p`
  margin: 0;
  font-size: 14px;
  color: ${props => props.theme.colors.textSecondary};
`;

const IconWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin: ${props => props.theme.isRTL ? '0 0 0 12px' : '0 12px 0 0'};
`;

const Notification = React.memo<NotificationProps>(({
  id,
  title,
  message,
  type = 'info',
  duration = 5000,
  dismissible = true,
  position = 'top-right',
  onDismiss,
  icon,
  priority = 0,
  isRTL = false,
  customAnimation
}) => {
  const { theme } = useTheme();
  const { trackNotification } = useAnalytics();
  const highContrast = theme.mode === 'high-contrast';

  const handleDismiss = useCallback(() => {
    trackNotification({
      id,
      type,
      action: 'dismiss',
      duration: Date.now() - mountTime
    });
    onDismiss();
  }, [id, type, onDismiss, trackNotification]);

  const mountTime = Date.now();

  useEffect(() => {
    trackNotification({
      id,
      type,
      action: 'show',
      priority
    });

    let dismissTimeout: NodeJS.Timeout;
    if (duration && duration > 0) {
      dismissTimeout = setTimeout(handleDismiss, duration);
    }

    return () => {
      if (dismissTimeout) {
        clearTimeout(dismissTimeout);
      }
    };
  }, [id, type, duration, handleDismiss, priority, trackNotification]);

  const animationConfig = {
    ...defaultAnimation,
    ...customAnimation
  };

  return (
    <AnimatePresence>
      <StyledNotification
        role="alert"
        aria-live="polite"
        className={classNames('blitzy-notification', `blitzy-notification--${type}`)}
        type={type}
        position={position}
        isRTL={isRTL}
        highContrast={highContrast}
        initial={animationConfig.initial}
        animate={animationConfig.animate}
        exit={animationConfig.exit}
        data-testid={`notification-${id}`}
      >
        {icon && <IconWrapper>{icon}</IconWrapper>}
        
        <NotificationContent>
          <NotificationTitle>{title}</NotificationTitle>
          <NotificationMessage>{message}</NotificationMessage>
        </NotificationContent>

        {dismissible && (
          <Button
            variant="tertiary"
            size="small"
            onClick={handleDismiss}
            aria-label="Dismiss notification"
            icon="×"
          />
        )}
      </StyledNotification>
    </AnimatePresence>
  );
});

Notification.displayName = 'Notification';

export type { NotificationProps };
export default Notification;