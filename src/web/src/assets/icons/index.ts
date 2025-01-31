import React from 'react'; // ^18.0.0
import { type BlitzyThemeConfig } from '../types/blitzy';

/**
 * Standard icon sizes in pixels following Blitzy Enterprise Design System
 */
export const IconSizes = {
  sm: 16,
  md: 24,
  lg: 32,
} as const;

/**
 * Default accessibility and interaction properties for icons
 */
export const IconDefaults = {
  role: 'img' as const,
  focusable: false,
  'aria-hidden': false,
} as const;

/**
 * Base props interface for icon components with theme and accessibility support
 */
export interface IconProps {
  /** Icon size variant - defaults to 'md' */
  size?: 'sm' | 'md' | 'lg';
  /** Icon color - defaults to currentColor for theme inheritance */
  color?: string;
  /** Optional CSS class name for custom styling */
  className?: string;
  /** Accessible title for screen readers */
  title?: string;
  /** Accessibility role - defaults to 'img' */
  role?: 'img' | 'presentation';
}

/**
 * Alert and warning notification icon with theme-aware colors
 */
export const AlertIcon: React.FC<IconProps> = ({
  size = 'md',
  color = 'currentColor',
  className,
  title = 'Alert',
  role = IconDefaults.role,
}) => (
  <svg
    width={IconSizes[size]}
    height={IconSizes[size]}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    className={className}
    role={role}
    aria-hidden={!title}
    {...IconDefaults}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
    {title && <title>{title}</title>}
  </svg>
);

/**
 * Analytics and metrics visualization icon with theme support
 */
export const ChartIcon: React.FC<IconProps> = ({
  size = 'md',
  color = 'currentColor',
  className,
  title = 'Chart',
  role = IconDefaults.role,
}) => (
  <svg
    width={IconSizes[size]}
    height={IconSizes[size]}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    className={className}
    role={role}
    aria-hidden={!title}
    {...IconDefaults}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 13v-1m4 1v-3m4 3V8M12 21a9 9 0 11-18 0 9 9 0 0118 0z"
    />
    {title && <title>{title}</title>}
  </svg>
);

/**
 * Customer profile and account icon with theme variants
 */
export const CustomerIcon: React.FC<IconProps> = ({
  size = 'md',
  color = 'currentColor',
  className,
  title = 'Customer',
  role = IconDefaults.role,
}) => (
  <svg
    width={IconSizes[size]}
    height={IconSizes[size]}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    className={className}
    role={role}
    aria-hidden={!title}
    {...IconDefaults}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
    />
    {title && <title>{title}</title>}
  </svg>
);

/**
 * Automation playbook and workflow icon with theme awareness
 */
export const PlaybookIcon: React.FC<IconProps> = ({
  size = 'md',
  color = 'currentColor',
  className,
  title = 'Playbook',
  role = IconDefaults.role,
}) => (
  <svg
    width={IconSizes[size]}
    height={IconSizes[size]}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    className={className}
    role={role}
    aria-hidden={!title}
    {...IconDefaults}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
    />
    {title && <title>{title}</title>}
  </svg>
);

/**
 * Risk assessment and health score icon with theme support
 */
export const RiskIcon: React.FC<IconProps> = ({
  size = 'md',
  color = 'currentColor',
  className,
  title = 'Risk',
  role = IconDefaults.role,
}) => (
  <svg
    width={IconSizes[size]}
    height={IconSizes[size]}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    className={className}
    role={role}
    aria-hidden={!title}
    {...IconDefaults}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
    />
    {title && <title>{title}</title>}
  </svg>
);