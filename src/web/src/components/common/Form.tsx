import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import classnames from 'classnames'; // ^2.3.2
import * as yup from 'yup'; // ^1.0.0
import { Input } from './Input';
import { BlitzyComponentProps } from '../../types/blitzy';
import { ValidationError } from '../../utils/validation';

// Form-specific constants
const VALIDATION_DEBOUNCE_MS = 300;
const CSRF_TOKEN_HEADER = 'X-CSRF-Token';
const PERFORMANCE_METRIC_NAME = 'form-interaction';

export interface FormProps extends BlitzyComponentProps {
  onSubmit: (values: Record<string, any>, context: FormContextValue) => void | Promise<void>;
  initialValues?: Record<string, any>;
  validationSchema?: yup.ObjectSchema<any>;
  children: React.ReactNode;
  loading?: boolean;
  validateOnBlur?: boolean;
  validateOnChange?: boolean;
  validateDebounceMs?: number;
}

export interface FormContextValue {
  values: Record<string, any>;
  errors: Record<string, ValidationError>;
  touched: Record<string, boolean>;
  handleChange: (field: string, value: any) => void;
  handleBlur: (field: string) => void;
  isSubmitting: boolean;
  isValidating: boolean;
  resetForm: () => void;
}

// Create form context with type safety
const FormContext = React.createContext<FormContextValue | undefined>(undefined);

// Custom hook for form state management
const useForm = (props: FormProps): FormContextValue => {
  const {
    initialValues = {},
    validationSchema,
    validateOnBlur = true,
    validateOnChange = false,
    validateDebounceMs = VALIDATION_DEBOUNCE_MS
  } = props;

  const [values, setValues] = React.useState(initialValues);
  const [errors, setErrors] = React.useState<Record<string, ValidationError>>({});
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isValidating, setIsValidating] = React.useState(false);

  // Validation cache for performance optimization
  const validationCache = useRef<Map<string, any>>(new Map());

  // Debounced validation handler
  const debouncedValidate = useCallback(
    React.useMemo(
      () =>
        debounce(async (fieldName?: string) => {
          if (!validationSchema) return;

          try {
            setIsValidating(true);
            const fieldsToValidate = fieldName ? [fieldName] : Object.keys(values);
            
            await Promise.all(
              fieldsToValidate.map(async (field) => {
                const value = values[field];
                const cacheKey = `${field}:${JSON.stringify(value)}`;

                if (validationCache.current.has(cacheKey)) {
                  return validationCache.current.get(cacheKey);
                }

                try {
                  await validationSchema.validateAt(field, values);
                  validationCache.current.set(cacheKey, null);
                  setErrors(prev => ({ ...prev, [field]: undefined }));
                } catch (error) {
                  if (error instanceof yup.ValidationError) {
                    const validationError = new ValidationError(
                      error.message,
                      field,
                      'VALIDATION_ERROR'
                    );
                    validationCache.current.set(cacheKey, validationError);
                    setErrors(prev => ({ ...prev, [field]: validationError }));
                  }
                }
              })
            );
          } finally {
            setIsValidating(false);
          }
        }, validateDebounceMs),
      [validationSchema, values, validateDebounceMs]
    ),
    [validationSchema, values, validateDebounceMs]
  );

  // Handle field change with validation
  const handleChange = useCallback(
    (field: string, value: any) => {
      setValues(prev => ({ ...prev, [field]: value }));
      
      if (validateOnChange) {
        debouncedValidate(field);
      }

      // Track performance metrics
      if (window.performance && window.performance.mark) {
        window.performance.mark(`${PERFORMANCE_METRIC_NAME}-change-${field}`);
      }
    },
    [validateOnChange, debouncedValidate]
  );

  // Handle field blur with validation
  const handleBlur = useCallback(
    (field: string) => {
      setTouched(prev => ({ ...prev, [field]: true }));
      
      if (validateOnBlur) {
        debouncedValidate(field);
      }
    },
    [validateOnBlur, debouncedValidate]
  );

  // Reset form to initial state
  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
    setIsValidating(false);
    validationCache.current.clear();
  }, [initialValues]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      debouncedValidate.cancel();
    };
  }, [debouncedValidate]);

  return {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    isSubmitting,
    isValidating,
    resetForm
  };
};

// Main Form component
const Form = React.memo<FormProps>(({
  onSubmit,
  children,
  loading = false,
  theme,
  className,
  variant = 'primary',
  ...props
}) => {
  const formContext = useForm(props);
  const formRef = useRef<HTMLFormElement>(null);

  // Handle form submission with validation
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const { values, setIsSubmitting } = formContext;
    setIsSubmitting(true);

    try {
      // Validate all fields
      if (props.validationSchema) {
        await props.validationSchema.validate(values, { abortEarly: false });
      }

      // Add CSRF token to headers if available
      const csrfToken = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content;
      if (csrfToken) {
        const headers = new Headers();
        headers.append(CSRF_TOKEN_HEADER, csrfToken);
      }

      // Execute onSubmit handler
      await onSubmit(values, formContext);
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        error.inner.forEach(err => {
          formContext.errors[err.path] = new ValidationError(
            err.message,
            err.path,
            'VALIDATION_ERROR'
          );
        });
      } else {
        console.error('Form submission error:', error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generate form classes based on theme and variant
  const formClasses = classnames(
    'blitzy-form',
    {
      'blitzy-form--loading': loading,
      'blitzy-form--submitting': formContext.isSubmitting,
      [`blitzy-form--${variant}`]: variant,
      'opacity-50 pointer-events-none': loading || formContext.isSubmitting
    },
    className
  );

  return (
    <FormContext.Provider value={formContext}>
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className={formClasses}
        noValidate
        aria-busy={loading || formContext.isSubmitting}
      >
        {children}
      </form>
    </FormContext.Provider>
  );
});

Form.displayName = 'Form';

// Export form hook for external form state management
export const useFormContext = () => {
  const context = React.useContext(FormContext);
  if (!context) {
    throw new Error('useFormContext must be used within a Form component');
  }
  return context;
};

export default Form;