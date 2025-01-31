import React, { useEffect, useCallback, useRef } from 'react';
import styled from '@emotion/styled';
import { AnimatePresence, motion } from 'framer-motion'; // ^6.0.0
import { Portal } from '@radix-ui/react-portal'; // ^1.0.0
import Button from './Button';
import { useTheme } from '../../hooks/useTheme';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'small' | 'medium' | 'large';
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  footer?: React.ReactNode;
  initialFocusRef?: React.RefObject<HTMLElement>;
  returnFocusRef?: React.RefObject<HTMLElement>;
  animationDuration?: number;
  overlayOpacity?: number;
  zIndex?: number;
  className?: string;
  testId?: string;
}

const StyledOverlay = styled(motion.div)<{ $opacity: number; $zIndex: number }>`
  position: fixed;
  inset: 0;
  background: ${({ theme }) => theme.colors.overlay};
  opacity: ${({ $opacity }) => $opacity};
  backdrop-filter: blur(4px);
  z-index: ${({ $zIndex }) => $zIndex};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.space?.[4] || '1rem'};
`;

const StyledModal = styled(motion.div)<{ $size: ModalProps['size'] }>`
  position: relative;
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.radii?.lg || '8px'};
  box-shadow: ${({ theme }) => theme.shadows?.xl || '0 25px 50px -12px rgba(0, 0, 0, 0.25)'};
  width: 100%;
  max-width: ${({ $size }) => ({
    small: '400px',
    medium: '600px',
    large: '800px'
  }[$size || 'medium'])};
  max-height: calc(100vh - 2rem);
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const ModalHeader = styled.header`
  padding: 1rem;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

const Content = styled.div`
  padding: 1rem;
  overflow-y: auto;
  flex: 1;
`;

const Footer = styled.footer`
  padding: 1rem;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
`;

const Modal = React.memo<ModalProps>(({
  isOpen,
  onClose,
  title,
  children,
  size = 'medium',
  showCloseButton = true,
  closeOnOverlayClick = true,
  footer,
  initialFocusRef,
  returnFocusRef,
  animationDuration = 0.2,
  overlayOpacity = 0.5,
  zIndex = 1000,
  className,
  testId = 'modal',
}) => {
  const { theme } = useTheme();
  const modalRef = useRef<HTMLDivElement>(null);
  const lastActiveElement = useRef<HTMLElement | null>(null);

  const handleEscape = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && isOpen) {
      onClose();
    }
  }, [isOpen, onClose]);

  const handleOverlayClick = useCallback((event: React.MouseEvent) => {
    if (closeOnOverlayClick && event.target === event.currentTarget) {
      onClose();
    }
  }, [closeOnOverlayClick, onClose]);

  // Focus management
  useEffect(() => {
    if (isOpen) {
      lastActiveElement.current = document.activeElement as HTMLElement;
      
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else if (modalRef.current) {
        modalRef.current.focus();
      }

      // Lock body scroll
      document.body.style.overflow = 'hidden';
    } else if (lastActiveElement.current && returnFocusRef?.current) {
      returnFocusRef.current.focus();
    }

    return () => {
      document.body.style.overflow = '';
      if (lastActiveElement.current && !returnFocusRef?.current) {
        lastActiveElement.current.focus();
      }
    };
  }, [isOpen, initialFocusRef, returnFocusRef]);

  // Keyboard event listeners
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, handleEscape]);

  const modalVariants = {
    hidden: {
      opacity: 0,
      scale: 0.95,
      y: -20,
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      y: 20,
    }
  };

  return (
    <Portal>
      <AnimatePresence>
        {isOpen && (
          <StyledOverlay
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: animationDuration }}
            onClick={handleOverlayClick}
            $opacity={overlayOpacity}
            $zIndex={zIndex}
            theme={theme}
            data-testid={`${testId}-overlay`}
          >
            <StyledModal
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={`${testId}-title`}
              tabIndex={-1}
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={modalVariants}
              transition={{ duration: animationDuration, type: 'spring', damping: 25 }}
              $size={size}
              theme={theme}
              className={className}
              data-testid={testId}
            >
              <ModalHeader theme={theme}>
                <Title id={`${testId}-title`} theme={theme}>
                  {title}
                </Title>
                {showCloseButton && (
                  <Button
                    variant="tertiary"
                    size="small"
                    onClick={onClose}
                    aria-label="Close modal"
                    data-testid={`${testId}-close`}
                  >
                    ✕
                  </Button>
                )}
              </ModalHeader>

              <Content theme={theme}>
                {children}
              </Content>

              {footer && (
                <Footer theme={theme}>
                  {footer}
                </Footer>
              )}
            </StyledModal>
          </StyledOverlay>
        )}
      </AnimatePresence>
    </Portal>
  );
});

Modal.displayName = 'Modal';

export default Modal;