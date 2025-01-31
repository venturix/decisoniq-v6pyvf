import React, { useState, useCallback, useRef, useEffect } from 'react'; // ^18.0.0
import classnames from 'classnames'; // ^2.3.2
import { BlitzyComponentProps } from '../../types/blitzy';
import { useTheme } from '../../hooks/useTheme';
import { ValidationError } from '../../utils/validation';

// Input component constants
const INPUT_VARIANTS = ['primary', 'secondary', 'tertiary'] as const;
const INPUT_SIZES = ['sm', 'md', 'lg'] as const;
const INPUT_TYPES = ['text', 'password', 'email', 'number', 'tel', 'url', 'search', 'date'] as const;

// Size-specific styles mapping
const SIZE_STYLES = {
  sm: 'h-8 text-sm px-2',
  md: 'h-10 text-base px-3',
  lg: 'h-12 text-lg px-4'
} as const;

export interface InputProps extends BlitzyComponentProps {
  type?: typeof INPUT_TYPES[number];
  value: string | number;
  onChange: (value: string | number, event: React.ChangeEvent<HTMLInputElement>) => void;
  label?: string;
  error?: string | ValidationError;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  autoComplete?: string;
  name?: string;
  mask?: string | RegExp;
  maxLength?: number;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  clearable?: boolean;
  showPasswordToggle?: boolean;
}

const Input = React.memo<InputProps>(({
  type = 'text',
  value,
  onChange,
  label,
  error,
  placeholder,
  disabled = false,
  required = false,
  autoComplete,
  name,
  mask,
  maxLength,
  prefix,
  suffix,
  clearable = false,
  showPasswordToggle = false,
  variant = 'primary',
  size = 'md',
  className,
  theme: propTheme
}) => {
  const { theme: contextTheme } = useTheme();
  const theme = propTheme || contextTheme;
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [maskedValue, setMaskedValue] = useState<string>(String(value));

  // Error handling
  const errorMessage = error instanceof ValidationError ? error.message : error;
  const hasError = Boolean(errorMessage);

  // Generate unique ID for input-label association
  const inputId = useRef(`input-${Math.random().toString(36).substr(2, 9)}`);

  // Handle input masking
  useEffect(() => {
    if (mask) {
      let newValue = String(value);
      if (mask instanceof RegExp) {
        newValue = newValue.replace(mask, '');
      } else {
        let maskIndex = 0;
        newValue = newValue
          .split('')
          .map(char => {
            if (maskIndex >= mask.length) return '';
            if (mask[maskIndex] === '#') {
              maskIndex++;
              return /\d/.test(char) ? char : '';
            }
            if (mask[maskIndex] === 'A') {
              maskIndex++;
              return /[a-zA-Z]/.test(char) ? char : '';
            }
            return mask[maskIndex++];
          })
          .join('');
      }
      setMaskedValue(newValue);
    } else {
      setMaskedValue(String(value));
    }
  }, [value, mask]);

  // Handle input change with validation and masking
  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = event.target.value;
    
    if (maxLength) {
      newValue = newValue.slice(0, maxLength);
    }

    if (type === 'number') {
      const numValue = parseFloat(newValue);
      if (!isNaN(numValue)) {
        onChange(numValue, event);
      }
    } else {
      onChange(newValue, event);
    }
  }, [onChange, type, maxLength]);

  // Handle clear button click
  const handleClear = useCallback(() => {
    if (inputRef.current) {
      const event = new Event('change', { bubbles: true });
      inputRef.current.value = '';
      inputRef.current.dispatchEvent(event);
      onChange('', event as unknown as React.ChangeEvent<HTMLInputElement>);
    }
  }, [onChange]);

  // Generate CSS classes based on current state
  const inputClasses = classnames(
    'blitzy-input',
    'w-full rounded-md transition-colors duration-200',
    'focus:outline-none focus:ring-2',
    SIZE_STYLES[size],
    {
      'border-2': variant === 'primary',
      'border': variant !== 'primary',
      'bg-white dark:bg-gray-800': !disabled,
      'bg-gray-100 dark:bg-gray-700 cursor-not-allowed': disabled,
      'border-red-500 focus:ring-red-200': hasError,
      [`border-${theme.colors.primary} focus:ring-${theme.colors.primary}/20`]: !hasError && isFocused,
      'border-gray-300 dark:border-gray-600': !hasError && !isFocused,
      'pl-10': Boolean(prefix),
      'pr-10': Boolean(suffix) || clearable || (type === 'password' && showPasswordToggle),
    },
    className
  );

  // Generate wrapper classes for prefix/suffix positioning
  const wrapperClasses = classnames(
    'relative w-full',
    {
      'opacity-60 cursor-not-allowed': disabled,
    }
  );

  return (
    <div className="blitzy-input-wrapper">
      {label && (
        <label
          htmlFor={inputId.current}
          className={classnames(
            'block mb-2 font-medium',
            {
              'text-red-500': hasError,
              'text-gray-700 dark:text-gray-200': !hasError,
            }
          )}
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className={wrapperClasses}>
        {prefix && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
            {prefix}
          </div>
        )}

        <input
          ref={inputRef}
          id={inputId.current}
          type={showPassword ? 'text' : type}
          value={maskedValue}
          onChange={handleChange}
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          autoComplete={autoComplete}
          name={name}
          maxLength={maxLength}
          className={inputClasses}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${inputId.current}-error` : undefined}
          aria-required={required}
        />

        {suffix && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
            {suffix}
          </div>
        )}

        {clearable && value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label="Clear input"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {type === 'password' && showPasswordToggle && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {showPassword ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              )}
            </svg>
          </button>
        )}
      </div>

      {hasError && (
        <p
          id={`${inputId.current}-error`}
          className="mt-2 text-sm text-red-500"
          role="alert"
        >
          {errorMessage}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;