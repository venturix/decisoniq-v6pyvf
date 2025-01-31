import React, { useRef, useEffect, useState } from 'react'; // ^18.0.0
import { AnimatePresence, motion } from 'framer-motion'; // ^10.0.0
import { type BlitzyComponentProps } from '../../types/blitzy';
import { useTheme } from '../../hooks/useTheme';

/**
 * Props interface for the Tooltip component
 * Extends BlitzyComponentProps for consistent theming
 */
interface TooltipProps extends BlitzyComponentProps {
  /** Content to display in the tooltip */
  content: React.ReactNode;
  /** Element that triggers the tooltip */
  children: React.ReactElement;
  /** Preferred tooltip position */
  position?: 'top' | 'right' | 'bottom' | 'left';
  /** Delay before showing tooltip (ms) */
  delay?: number;
  /** Offset from trigger element (px) */
  offset?: number;
  /** Unique identifier for ARIA attributes */
  id?: string;
  /** Accessible label for screen readers */
  ariaLabel?: string;
}

/**
 * Interface for tooltip positioning calculations
 */
interface Position {
  top: number;
  left: number;
  transformOrigin: string;
}

/**
 * Calculate tooltip position with viewport boundary detection
 */
const calculatePosition = (
  triggerRect: DOMRect,
  tooltipRect: DOMRect,
  position: TooltipProps['position'],
  offset: number
): Position => {
  const positions: Record<NonNullable<TooltipProps['position']>, () => Position> = {
    top: () => ({
      top: triggerRect.top - tooltipRect.height - offset,
      left: triggerRect.left + (triggerRect.width - tooltipRect.width) / 2,
      transformOrigin: 'bottom'
    }),
    bottom: () => ({
      top: triggerRect.bottom + offset,
      left: triggerRect.left + (triggerRect.width - tooltipRect.width) / 2,
      transformOrigin: 'top'
    }),
    left: () => ({
      top: triggerRect.top + (triggerRect.height - tooltipRect.height) / 2,
      left: triggerRect.left - tooltipRect.width - offset,
      transformOrigin: 'right'
    }),
    right: () => ({
      top: triggerRect.top + (triggerRect.height - tooltipRect.height) / 2,
      left: triggerRect.right + offset,
      transformOrigin: 'left'
    })
  };

  // Get initial position
  const pos = positions[position || 'top']();

  // Check viewport boundaries and flip if necessary
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight
  };

  if (pos.left < 0) {
    pos.left = offset;
  } else if (pos.left + tooltipRect.width > viewport.width) {
    pos.left = viewport.width - tooltipRect.width - offset;
  }

  if (pos.top < 0) {
    return positions.bottom();
  } else if (pos.top + tooltipRect.height > viewport.height) {
    return positions.top();
  }

  return pos;
};

/**
 * Tooltip component that provides contextual information with accessibility support
 * and theme-aware styling
 */
export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 200,
  offset = 8,
  id,
  ariaLabel,
  className,
  variant = 'primary'
}) => {
  const { theme } = useTheme();
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<Position | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Generate unique ID for ARIA attributes
  const tooltipId = id || `tooltip-${Math.random().toString(36).substr(2, 9)}`;

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      if (triggerRef.current && tooltipRef.current) {
        const position = calculatePosition(
          triggerRef.current.getBoundingClientRect(),
          tooltipRef.current.getBoundingClientRect(),
          position,
          offset
        );
        setTooltipPosition(position);
        setIsVisible(true);
      }
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Animation variants
  const tooltipVariants = {
    hidden: {
      opacity: 0,
      scale: 0.95,
      transition: { duration: 0.1 }
    },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.2 }
    }
  };

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleMouseEnter}
        onBlur={handleMouseLeave}
        aria-describedby={tooltipId}
      >
        {children}
      </div>

      <AnimatePresence>
        {isVisible && tooltipPosition && (
          <motion.div
            ref={tooltipRef}
            id={tooltipId}
            role="tooltip"
            aria-label={ariaLabel}
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={tooltipVariants}
            style={{
              position: 'fixed',
              top: tooltipPosition.top,
              left: tooltipPosition.left,
              transformOrigin: tooltipPosition.transformOrigin,
              zIndex: 1000
            }}
            className={`tooltip ${className || ''}`}
          >
            <div
              style={{
                background: theme.colors.surface,
                color: theme.colors.text,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '4px',
                padding: '8px 12px',
                fontSize: '14px',
                maxWidth: '250px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
            >
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

Tooltip.defaultProps = {
  position: 'top',
  delay: 200,
  offset: 8,
  variant: 'primary'
};

export default Tooltip;