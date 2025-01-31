import React, { useState, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form'; // ^7.45.0
import * as yup from 'yup'; // ^1.2.0
import FingerprintJS from '@fingerprintjs/fingerprintjs-pro'; // ^3.8.0
import { useAuth } from '../../hooks/useAuth';
import { LoginCredentials } from '../../types/auth';
import { useTheme } from '../../hooks/useTheme';

// Validation schema with enterprise-grade security requirements
const loginSchema = yup.object().shape({
  email: yup
    .string()
    .required('Email is required')
    .email('Invalid email format')
    .max(255)
    .matches(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/),
  password: yup
    .string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    ),
  mfaCode: yup
    .string()
    .matches(/^\d{6}$/, 'MFA code must be 6 digits')
    .when('requireMFA', {
      is: true,
      then: yup.string().required('MFA code is required'),
    }),
});

interface LoginFormProps {
  onSuccess: (user: User, session: Session) => void;
  onError: (error: AuthError) => void;
  redirectUrl?: string;
  maxAttempts?: number;
  requireMFA?: boolean;
  theme?: ThemeConfig;
}

const LoginForm: React.FC<LoginFormProps> = React.memo(({
  onSuccess,
  onError,
  redirectUrl = '/',
  maxAttempts = 3,
  requireMFA = false,
  theme: propTheme,
}) => {
  const { login, loginWithSSO, verifyMFA } = useAuth();
  const { theme: appTheme } = useTheme();
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [showMFA, setShowMFA] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutEndTime, setLockoutEndTime] = useState<number | null>(null);
  const [deviceFingerprint, setDeviceFingerprint] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    clearErrors,
  } = useForm<LoginCredentials>({
    resolver: yupResolver(loginSchema),
    mode: 'onBlur',
  });

  // Initialize device fingerprinting
  useEffect(() => {
    const initializeFingerprint = async () => {
      try {
        const fp = await FingerprintJS.load({
          apiKey: process.env.VITE_FINGERPRINT_API_KEY,
        });
        const result = await fp.get();
        setDeviceFingerprint(result.visitorId);
      } catch (error) {
        console.error('Error initializing fingerprint:', error);
      }
    };
    initializeFingerprint();
  }, []);

  // Handle account lockout timer
  useEffect(() => {
    if (isLocked && lockoutEndTime) {
      const timer = setInterval(() => {
        if (Date.now() >= lockoutEndTime) {
          setIsLocked(false);
          setLockoutEndTime(null);
          setLoginAttempts(0);
        }
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isLocked, lockoutEndTime]);

  const handleLogin = useCallback(async (data: LoginCredentials) => {
    if (isLocked) return;

    try {
      clearErrors();
      const credentials = {
        ...data,
        deviceFingerprint,
      };

      const response = await login(credentials);

      if (response.requiresMFA || requireMFA) {
        setShowMFA(true);
        return;
      }

      onSuccess(response.user, response.session);
      window.location.href = redirectUrl;
    } catch (error) {
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);

      if (newAttempts >= maxAttempts) {
        setIsLocked(true);
        setLockoutEndTime(Date.now() + 15 * 60 * 1000); // 15 minutes lockout
        onError(new Error('Account locked due to too many failed attempts'));
      } else {
        setError('root', {
          type: 'manual',
          message: error.message || 'Invalid credentials',
        });
        onError(error);
      }
    }
  }, [
    login,
    loginAttempts,
    maxAttempts,
    deviceFingerprint,
    isLocked,
    onSuccess,
    onError,
    redirectUrl,
    requireMFA,
    setError,
    clearErrors,
  ]);

  const handleMFASubmit = useCallback(async (data: LoginCredentials) => {
    try {
      const response = await verifyMFA(data.mfaCode);
      onSuccess(response.user, response.session);
      window.location.href = redirectUrl;
    } catch (error) {
      setError('mfaCode', {
        type: 'manual',
        message: 'Invalid MFA code',
      });
      onError(error);
    }
  }, [verifyMFA, onSuccess, onError, redirectUrl, setError]);

  const handleSSOClick = useCallback(async () => {
    try {
      await loginWithSSO();
    } catch (error) {
      onError(error);
    }
  }, [loginWithSSO, onError]);

  const theme = propTheme || appTheme;

  return (
    <div
      className="login-form-container"
      style={{
        backgroundColor: theme.colors.background,
        color: theme.colors.text,
      }}
    >
      <form
        onSubmit={handleSubmit(showMFA ? handleMFASubmit : handleLogin)}
        className="login-form"
        aria-labelledby="login-title"
      >
        <h1 id="login-title" className="login-title">
          {showMFA ? 'Enter MFA Code' : 'Sign In'}
        </h1>

        {!showMFA && (
          <>
            <div className="form-group">
              <label htmlFor="email" className="form-label">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                {...register('email')}
                className="form-input"
                aria-invalid={!!errors.email}
                disabled={isLocked}
                autoComplete="email"
              />
              {errors.email && (
                <span className="error-message" role="alert">
                  {errors.email.message}
                </span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <input
                id="password"
                type="password"
                {...register('password')}
                className="form-input"
                aria-invalid={!!errors.password}
                disabled={isLocked}
                autoComplete="current-password"
              />
              {errors.password && (
                <span className="error-message" role="alert">
                  {errors.password.message}
                </span>
              )}
            </div>
          </>
        )}

        {showMFA && (
          <div className="form-group">
            <label htmlFor="mfaCode" className="form-label">
              MFA Code
            </label>
            <input
              id="mfaCode"
              type="text"
              {...register('mfaCode')}
              className="form-input"
              aria-invalid={!!errors.mfaCode}
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
            />
            {errors.mfaCode && (
              <span className="error-message" role="alert">
                {errors.mfaCode.message}
              </span>
            )}
          </div>
        )}

        {isLocked && lockoutEndTime && (
          <div className="lockout-message" role="alert">
            Account locked. Try again in {Math.ceil((lockoutEndTime - Date.now()) / 60000)} minutes.
          </div>
        )}

        <button
          type="submit"
          className="submit-button"
          disabled={isSubmitting || isLocked}
          style={{
            backgroundColor: theme.colors.primary,
            color: theme.colors.background,
          }}
        >
          {isSubmitting ? 'Signing in...' : showMFA ? 'Verify' : 'Sign In'}
        </button>

        {!showMFA && (
          <button
            type="button"
            onClick={handleSSOClick}
            className="sso-button"
            style={{
              backgroundColor: theme.colors.secondary,
              color: theme.colors.background,
            }}
          >
            Sign in with SSO
          </button>
        )}
      </form>
    </div>
  );
});

LoginForm.displayName = 'LoginForm';

export default LoginForm;