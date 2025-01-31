import * as yup from 'yup'; // v1.0.0 - Enterprise-grade schema validation

/**
 * Interface defining the structure for login credentials with strict type safety
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Custom error class for handling validation errors with enhanced tracking and categorization
 */
export class ValidationError extends Error {
  readonly field: string;
  readonly code: string;

  constructor(message: string, field: string, code: string) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.code = code;
    
    // Ensure proper prototype chain for error handling
    Object.setPrototypeOf(this, ValidationError.prototype);
    
    // Capture stack trace for debugging in non-production environments
    if (process.env.NODE_ENV !== 'production') {
      Error.captureStackTrace(this, ValidationError);
    }
  }
}

/**
 * RFC 5322 compliant email validation with comprehensive error handling
 * @param email - Email address to validate
 * @throws {ValidationError} If email is invalid with specific error code
 * @returns {boolean} True if email is valid
 */
export const validateEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') {
    throw new ValidationError(
      'Email is required',
      'email',
      'EMAIL_REQUIRED'
    );
  }

  const sanitizedEmail = email.trim().toLowerCase();

  // RFC 5322 compliant email regex
  const emailRegex = /^(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])$/;

  if (!emailRegex.test(sanitizedEmail)) {
    throw new ValidationError(
      'Invalid email format',
      'email',
      'EMAIL_INVALID_FORMAT'
    );
  }

  // Additional enterprise-grade validations
  if (sanitizedEmail.length > 254) {
    throw new ValidationError(
      'Email exceeds maximum length',
      'email',
      'EMAIL_TOO_LONG'
    );
  }

  const [localPart, domain] = sanitizedEmail.split('@');
  if (localPart.length > 64) {
    throw new ValidationError(
      'Local part of email exceeds maximum length',
      'email',
      'EMAIL_LOCAL_TOO_LONG'
    );
  }

  // Validate domain specific requirements
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/.test(domain)) {
    throw new ValidationError(
      'Invalid email domain format',
      'email',
      'EMAIL_INVALID_DOMAIN'
    );
  }

  return true;
};

/**
 * Enterprise security compliant password validation
 * @param password - Password to validate
 * @throws {ValidationError} If password doesn't meet security requirements
 * @returns {boolean} True if password meets all requirements
 */
export const validatePassword = (password: string): boolean => {
  if (!password || typeof password !== 'string') {
    throw new ValidationError(
      'Password is required',
      'password',
      'PASSWORD_REQUIRED'
    );
  }

  // Enterprise security requirements
  const requirements = [
    {
      test: (pwd: string) => pwd.length >= 8,
      message: 'Password must be at least 8 characters long',
      code: 'PASSWORD_TOO_SHORT'
    },
    {
      test: (pwd: string) => /[A-Z]/.test(pwd),
      message: 'Password must contain at least one uppercase letter',
      code: 'PASSWORD_NO_UPPERCASE'
    },
    {
      test: (pwd: string) => /[a-z]/.test(pwd),
      message: 'Password must contain at least one lowercase letter',
      code: 'PASSWORD_NO_LOWERCASE'
    },
    {
      test: (pwd: string) => /[0-9]/.test(pwd),
      message: 'Password must contain at least one number',
      code: 'PASSWORD_NO_NUMBER'
    },
    {
      test: (pwd: string) => /[!@#$%^&*(),.?":{}|<>]/.test(pwd),
      message: 'Password must contain at least one special character',
      code: 'PASSWORD_NO_SPECIAL'
    },
    {
      test: (pwd: string) => !/(.)\1{2,}/.test(pwd),
      message: 'Password cannot contain repeated characters',
      code: 'PASSWORD_REPEATED_CHARS'
    },
    {
      test: (pwd: string) => !/(password|123456|qwerty)/i.test(pwd),
      message: 'Password contains common patterns',
      code: 'PASSWORD_COMMON_PATTERN'
    }
  ];

  for (const requirement of requirements) {
    if (!requirement.test(password)) {
      throw new ValidationError(
        requirement.message,
        'password',
        requirement.code
      );
    }
  }

  return true;
};

/**
 * Comprehensive validation for login credentials
 * @param credentials - Login credentials to validate
 * @throws {ValidationError} If credentials are invalid
 * @returns {boolean} True if credentials are valid
 */
export const validateLoginCredentials = async (credentials: LoginCredentials): Promise<boolean> => {
  // Define validation schema using yup
  const loginSchema = yup.object().shape({
    email: yup.string().required('Email is required'),
    password: yup.string().required('Password is required')
  });

  try {
    // Validate structure using yup
    await loginSchema.validate(credentials, { abortEarly: false });
    
    // Perform detailed validation
    validateEmail(credentials.email);
    validatePassword(credentials.password);
    
    return true;
  } catch (error) {
    if (error instanceof yup.ValidationError) {
      throw new ValidationError(
        error.message,
        error.path || 'form',
        'INVALID_CREDENTIALS_FORMAT'
      );
    }
    throw error;
  }
};