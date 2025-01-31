import React from 'react'; // ^18.0.0
import classNames from 'classnames'; // ^2.3.0
import styled from '@emotion/styled'; // ^11.0.0
import { useTheme } from '../../hooks/useTheme';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  highContrast?: boolean;
}

const StyledSpinner = styled.span`
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  display: inline-block;
  width: 1em;
  height: 1em;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.75s linear infinite;
  margin-right: ${props => props.iconPosition === 'right' ? '0' : '0.5em'};
  margin-left: ${props => props.iconPosition === 'right' ? '0.5em' : '0'};
`;

const StyledButton = styled.button<ButtonProps>`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: inherit;
  font-weight: 500;
  border-radius: 6px;
  transition: all 200ms ease-in-out;
  cursor: pointer;
  outline: none;
  border: none;
  white-space: nowrap;
  
  /* Size variants */
  ${props => {
    switch (props.size) {
      case 'small':
        return `
          height: 32px;
          padding: 0 12px;
          font-size: 12px;
        `;
      case 'large':
        return `
          height: 48px;
          padding: 0 24px;
          font-size: 16px;
        `;
      default: // medium
        return `
          height: 40px;
          padding: 0 16px;
          font-size: 14px;
        `;
    }
  }}

  /* Width control */
  width: ${props => props.fullWidth ? '100%' : 'auto'};

  /* Theme-based variants */
  ${props => {
    const { theme } = props;
    const isHighContrast = props.highContrast || theme.mode === 'high-contrast';

    switch (props.variant) {
      case 'secondary':
        return `
          background: ${theme.colors.surface};
          color: ${theme.colors.primary};
          border: 1px solid ${theme.colors.primary};
          &:hover:not(:disabled) {
            background: ${theme.colors.hover};
          }
        `;
      case 'tertiary':
        return `
          background: transparent;
          color: ${theme.colors.text};
          &:hover:not(:disabled) {
            background: ${theme.colors.hover};
          }
        `;
      case 'danger':
        return `
          background: ${theme.colors.danger};
          color: ${theme.colors.background};
          &:hover:not(:disabled) {
            background: ${isHighContrast ? theme.colors.error : theme.colors.riskHigh};
          }
        `;
      default: // primary
        return `
          background: ${theme.colors.primary};
          color: ${theme.colors.background};
          &:hover:not(:disabled) {
            background: ${isHighContrast ? theme.colors.info : theme.colors.secondary};
          }
        `;
    }
  }}

  /* States */
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:focus-visible {
    box-shadow: 0 0 0 2px ${props => props.theme.colors.background},
                0 0 0 4px ${props => props.theme.colors.focus};
  }

  &:active:not(:disabled) {
    transform: scale(0.98);
  }

  /* Loading state styles */
  ${props => props.loading && `
    color: transparent !important;
    pointer-events: none;
    position: relative;
    
    &::after {
      content: '';
      position: absolute;
      width: 1em;
      height: 1em;
      border: 2px solid currentColor;
      border-right-color: transparent;
      border-radius: 50%;
      animation: spin 0.75s linear infinite;
    }
  `}
`;

const Button = React.memo<ButtonProps>(({
  variant = 'primary',
  size = 'medium',
  loading = false,
  fullWidth = false,
  icon,
  iconPosition = 'left',
  highContrast = false,
  disabled,
  children,
  className,
  ...props
}) => {
  const { theme } = useTheme();

  const buttonClasses = classNames(
    className,
    'blitzy-button',
    `blitzy-button--${variant}`,
    `blitzy-button--${size}`,
    {
      'blitzy-button--loading': loading,
      'blitzy-button--full-width': fullWidth,
      'blitzy-button--high-contrast': highContrast || theme.mode === 'high-contrast',
      'blitzy-button--with-icon': !!icon,
      [`blitzy-button--icon-${iconPosition}`]: !!icon,
    }
  );

  return (
    <StyledButton
      className={buttonClasses}
      disabled={disabled || loading}
      variant={variant}
      size={size}
      fullWidth={fullWidth}
      highContrast={highContrast}
      theme={theme}
      aria-busy={loading}
      aria-disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <StyledSpinner
          role="status"
          aria-label="Loading"
          iconPosition={iconPosition}
        />
      )}
      {!loading && icon && iconPosition === 'left' && icon}
      {children}
      {!loading && icon && iconPosition === 'right' && icon}
    </StyledButton>
  );
});

Button.displayName = 'Button';

export default Button;