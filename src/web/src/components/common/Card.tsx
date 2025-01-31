import React from 'react'; // ^18.0.0
import classNames from 'classnames'; // ^2.3.0
import { type BlitzyComponentProps } from '../../types/blitzy';
import { useTheme } from '../../lib/blitzy/theme';

/**
 * Props interface for the Card component extending BlitzyComponentProps
 * with enhanced theme and accessibility support
 */
interface CardProps extends BlitzyComponentProps {
  /** Visual style variant of the card */
  variant?: 'default' | 'elevated' | 'outlined';
  /** Card content */
  children: React.ReactNode;
  /** Optional custom CSS classes */
  className?: string;
  /** Enable high contrast mode for accessibility */
  highContrast?: boolean;
}

/**
 * Generates CSS classes for the card based on theme and variant
 */
const getCardClasses = (
  variant: CardProps['variant'],
  theme: BlitzyComponentProps['theme'],
  className?: string,
  highContrast?: boolean
): string => {
  return classNames(
    // Base card classes with semantic color mapping
    'card',
    'relative',
    'rounded-lg',
    'transition-all',
    'duration-200',
    {
      // Theme-based background colors
      'bg-surface': variant !== 'outlined',
      'dark:bg-surface': variant !== 'outlined' && theme.mode === 'dark',
      'bg-background': variant === 'outlined',
      'dark:bg-background': variant === 'outlined' && theme.mode === 'dark',

      // High contrast mode styles
      'border-2': highContrast,
      'border-black': highContrast && theme.mode === 'high-contrast',
      'text-black': highContrast && theme.mode === 'high-contrast',
      'bg-white': highContrast && theme.mode === 'high-contrast',

      // Variant-specific styles
      'shadow-sm': variant === 'default',
      'shadow-md hover:shadow-lg': variant === 'elevated',
      'border border-border dark:border-border': variant === 'outlined',

      // Responsive padding
      'p-4 sm:p-6': true,

      // Focus state for keyboard navigation
      'focus-within:ring-2': true,
      'focus-within:ring-primary': true,
      'focus-within:ring-offset-2': true,
    },
    className
  );
};

/**
 * Enhanced Card component with theme support and accessibility features
 */
export const Card: React.FC<CardProps> = React.memo(({
  variant = 'default',
  children,
  className,
  highContrast = false,
  ...props
}) => {
  const { theme } = useTheme();

  const cardClasses = React.useMemo(() => 
    getCardClasses(variant, theme, className, highContrast),
    [variant, theme, className, highContrast]
  );

  return (
    <div
      className={cardClasses}
      role="region"
      tabIndex={0}
      aria-label="Card content"
      {...props}
    >
      {children}
    </div>
  );
});

Card.displayName = 'Card';

export default Card;