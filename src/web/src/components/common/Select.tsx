import React, { useCallback, useMemo } from 'react'; // ^18.0.0
import classNames from 'classnames'; // ^2.3.2
import { type BlitzyComponentProps } from '../../types/blitzy';
import { useTheme } from '../../hooks/useTheme';

// Constants for component configuration
const SELECT_VARIANTS = {
  primary: 'primary',
  secondary: 'secondary',
  tertiary: 'tertiary',
} as const;

const SELECT_SIZES = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
} as const;

const DEBOUNCE_DELAY = 150;

interface SelectProps extends BlitzyComponentProps {
  options: Array<{ value: string | number; label: string }>;
  value: string | number;
  onChange: (value: string | number) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  id?: string;
  name?: string;
  required?: boolean;
  highContrast?: boolean;
  brandColors?: { primary: string; secondary: string };
}

export const Select = React.memo(
  React.forwardRef<HTMLSelectElement, SelectProps>(({
    options,
    value,
    onChange,
    placeholder,
    disabled = false,
    error,
    id,
    name,
    required = false,
    className,
    variant = 'primary',
    size = 'md',
    highContrast = false,
    brandColors,
  }, ref) => {
    const { theme } = useTheme();
    const isHighContrast = highContrast || theme.mode === 'high-contrast';

    // Generate dynamic class names based on props and theme
    const selectClasses = useMemo(() => classNames(
      'blitzy-select',
      `blitzy-select--${variant}`,
      `blitzy-select--${size}`,
      {
        'blitzy-select--disabled': disabled,
        'blitzy-select--error': error,
        'blitzy-select--high-contrast': isHighContrast,
        [className || '']: !!className,
      }
    ), [variant, size, disabled, error, isHighContrast, className]);

    // Generate custom styles for brand colors and high contrast mode
    const customStyles = useMemo(() => {
      const styles: React.CSSProperties = {};

      if (brandColors) {
        styles['--select-primary-color'] = brandColors.primary;
        styles['--select-secondary-color'] = brandColors.secondary;
      }

      if (isHighContrast) {
        styles['--select-border-width'] = '2px';
        styles['--select-focus-ring-width'] = '3px';
      }

      return styles;
    }, [brandColors, isHighContrast]);

    // Debounced onChange handler for performance
    const handleChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
      const newValue = event.target.value;
      const parsedValue = options.find(opt => opt.value.toString() === newValue)?.value;
      if (parsedValue !== undefined) {
        onChange(parsedValue);
      }
    }, [onChange, options]);

    // Generate unique ID for accessibility
    const selectId = useMemo(() => id || `select-${Math.random().toString(36).substr(2, 9)}`, [id]);
    const errorId = error ? `${selectId}-error` : undefined;

    return (
      <div className="blitzy-select-container">
        <select
          ref={ref}
          id={selectId}
          name={name}
          value={value.toString()}
          onChange={handleChange}
          disabled={disabled}
          required={required}
          aria-invalid={!!error}
          aria-describedby={errorId}
          aria-required={required}
          className={selectClasses}
          style={customStyles}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map(({ value: optValue, label }) => (
            <option
              key={optValue.toString()}
              value={optValue.toString()}
            >
              {label}
            </option>
          ))}
        </select>
        {error && (
          <div
            id={errorId}
            className="blitzy-select-error"
            role="alert"
            aria-live="polite"
          >
            {error}
          </div>
        )}
      </div>
    );
  })
);

Select.displayName = 'Select';

Select.defaultProps = {
  variant: 'primary',
  size: 'md',
  disabled: false,
  required: false,
  highContrast: false,
};

export default Select;