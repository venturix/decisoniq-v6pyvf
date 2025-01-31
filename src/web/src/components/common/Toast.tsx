import React from 'react'; // ^18.0.0
import styled from '@emotion/styled'; // ^11.0.0
import { AnimatePresence, motion } from 'framer-motion'; // ^6.0.0
import { useTheme } from '../../hooks/useTheme';
import Button from './Button';

export interface ToastProps {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  dismissible?: boolean;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  onDismiss: () => void;
  disableAnimation?: boolean;
  ariaLive?: 'polite' | 'assertive';
}

const StyledToast = styled(motion.div)<Pick<ToastProps, 'type' | 'position'>>`
  position: fixed;
  display: flex;
  align-items: flex-start;
  min-width: 320px;
  max-width: 480px;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 9999;

  ${({ position = 'top-right' }) => {
    switch (position) {
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

  ${({ theme, type }) => {
    const colors = theme.colors;
    switch (type) {
      case 'success':
        return `
          background-color: ${colors.success};
          color: ${colors.background};
          border-left: 4px solid ${colors.successLight};
        `;
      case 'error':
        return `
          background-color: ${colors.error};
          color: ${colors.background};
          border-left: 4px solid ${colors.errorLight};
        `;
      case 'warning':
        return `
          background-color: ${colors.warning};
          color: ${colors.text};
          border-left: 4px solid ${colors.warningLight};
        `;
      case 'info':
        return `
          background-color: ${colors.info};
          color: ${colors.background};
          border-left: 4px solid ${colors.infoLight};
        `;
    }
  }}
`;

const ToastIcon = styled.span`
  margin-right: 12px;
  font-size: 20px;
`;

const ToastContent = styled.div`
  flex: 1;
`;

const ToastTitle = styled.h6`
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
`;

const ToastMessage = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
`;

const getToastIcon = (type: ToastProps['type']): string => {
  switch (type) {
    case 'success':
      return '✓';
    case 'error':
      return '✕';
    case 'warning':
      return '⚠';
    case 'info':
      return 'ℹ';
  }
};

const Toast = React.memo<ToastProps>(({
  id,
  title,
  message,
  type,
  duration = 5000,
  dismissible = true,
  position = 'top-right',
  onDismiss,
  disableAnimation = false,
  ariaLive = 'polite'
}) => {
  const { theme } = useTheme();

  React.useEffect(() => {
    if (duration && duration > 0) {
      const timer = setTimeout(onDismiss, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onDismiss]);

  const animationVariants = {
    initial: disableAnimation ? { opacity: 0 } : {
      opacity: 0,
      y: position.includes('top') ? -20 : 20,
      scale: 0.95
    },
    animate: disableAnimation ? { opacity: 1 } : {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.2,
        ease: 'easeOut'
      }
    },
    exit: disableAnimation ? { opacity: 0 } : {
      opacity: 0,
      scale: 0.95,
      transition: {
        duration: 0.15,
        ease: 'easeIn'
      }
    }
  };

  return (
    <AnimatePresence mode="wait">
      <StyledToast
        key={id}
        role="alert"
        aria-live={ariaLive}
        theme={theme}
        type={type}
        position={position}
        variants={animationVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        tabIndex={0}
      >
        <ToastIcon aria-hidden="true">
          {getToastIcon(type)}
        </ToastIcon>
        <ToastContent>
          <ToastTitle>{title}</ToastTitle>
          <ToastMessage>{message}</ToastMessage>
        </ToastContent>
        {dismissible && (
          <Button
            variant="tertiary"
            size="small"
            onClick={onDismiss}
            aria-label="Close notification"
            style={{ marginLeft: '12px' }}
          >
            ✕
          </Button>
        )}
      </StyledToast>
    </AnimatePresence>
  );
});

Toast.displayName = 'Toast';

export default Toast;