import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import LoginForm from '../../../../src/components/auth/LoginForm';
import { useAuth } from '../../../../src/hooks/useAuth';
import { useTheme } from '../../../../src/hooks/useTheme';

// Add jest-axe custom matcher
expect.extend(toHaveNoViolations);

// Mock hooks
jest.mock('../../../../src/hooks/useAuth');
jest.mock('../../../../src/hooks/useTheme');

// Test data
const validCredentials = {
  email: 'test@example.com',
  password: 'Password123!',
};

const invalidCredentials = {
  email: 'invalid-email',
  password: 'short',
};

const mfaData = {
  code: '123456',
  invalidCode: '000000',
};

describe('LoginForm', () => {
  // Mock implementations
  const mockLogin = jest.fn();
  const mockLoginWithSSO = jest.fn();
  const mockVerifyMFA = jest.fn();
  const mockOnSuccess = jest.fn();
  const mockOnError = jest.fn();
  const mockToggleTheme = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock useAuth hook
    (useAuth as jest.Mock).mockReturnValue({
      login: mockLogin,
      loginWithSSO: mockLoginWithSSO,
      verifyMFA: mockVerifyMFA,
    });

    // Mock useTheme hook
    (useTheme as jest.Mock).mockReturnValue({
      theme: {
        mode: 'light',
        colors: {
          background: '#FFFFFF',
          text: '#212529',
          primary: '#0066CC',
          error: '#DC3545',
        },
      },
      toggleTheme: mockToggleTheme,
    });
  });

  describe('Authentication Flow', () => {
    it('should handle successful email/password login', async () => {
      mockLogin.mockResolvedValueOnce({ user: { id: '1' }, session: {} });

      render(
        <LoginForm
          onSuccess={mockOnSuccess}
          onError={mockOnError}
          redirectUrl="/dashboard"
        />
      );

      await userEvent.type(screen.getByLabelText(/email/i), validCredentials.email);
      await userEvent.type(screen.getByLabelText(/password/i), validCredentials.password);
      
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith(expect.objectContaining({
          email: validCredentials.email,
          password: validCredentials.password,
          deviceFingerprint: expect.any(String),
        }));
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });

    it('should handle MFA verification flow', async () => {
      mockLogin.mockResolvedValueOnce({ requiresMFA: true });
      mockVerifyMFA.mockResolvedValueOnce({ user: { id: '1' }, session: {} });

      render(
        <LoginForm
          onSuccess={mockOnSuccess}
          onError={mockOnError}
          requireMFA={true}
        />
      );

      // Initial login
      await userEvent.type(screen.getByLabelText(/email/i), validCredentials.email);
      await userEvent.type(screen.getByLabelText(/password/i), validCredentials.password);
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      // MFA verification
      await waitFor(() => {
        expect(screen.getByLabelText(/mfa code/i)).toBeInTheDocument();
      });

      await userEvent.type(screen.getByLabelText(/mfa code/i), mfaData.code);
      fireEvent.click(screen.getByRole('button', { name: /verify/i }));

      await waitFor(() => {
        expect(mockVerifyMFA).toHaveBeenCalledWith(mfaData.code);
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });

    it('should handle SSO authentication', async () => {
      mockLoginWithSSO.mockResolvedValueOnce({ user: { id: '1' }, session: {} });

      render(
        <LoginForm
          onSuccess={mockOnSuccess}
          onError={mockOnError}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /sign in with sso/i }));

      await waitFor(() => {
        expect(mockLoginWithSSO).toHaveBeenCalled();
      });
    });

    it('should handle login failures and rate limiting', async () => {
      mockLogin.mockRejectedValue(new Error('Invalid credentials'));

      const { rerender } = render(
        <LoginForm
          onSuccess={mockOnSuccess}
          onError={mockOnError}
          maxAttempts={3}
        />
      );

      // Attempt login multiple times
      for (let i = 0; i < 3; i++) {
        await userEvent.type(screen.getByLabelText(/email/i), validCredentials.email);
        await userEvent.type(screen.getByLabelText(/password/i), validCredentials.password);
        fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

        // Clear inputs for next attempt
        await waitFor(() => {
          expect(mockOnError).toHaveBeenCalled();
        });
        rerender(
          <LoginForm
            onSuccess={mockOnSuccess}
            onError={mockOnError}
            maxAttempts={3}
          />
        );
      }

      // Verify account lockout
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/account locked/i);
        expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <LoginForm
          onSuccess={mockOnSuccess}
          onError={mockOnError}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation', async () => {
      render(
        <LoginForm
          onSuccess={mockOnSuccess}
          onError={mockOnError}
        />
      );

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const signInButton = screen.getByRole('button', { name: /sign in/i });
      const ssoButton = screen.getByRole('button', { name: /sign in with sso/i });

      // Tab through form elements
      await userEvent.tab();
      expect(emailInput).toHaveFocus();

      await userEvent.tab();
      expect(passwordInput).toHaveFocus();

      await userEvent.tab();
      expect(signInButton).toHaveFocus();

      await userEvent.tab();
      expect(ssoButton).toHaveFocus();
    });

    it('should display validation errors accessibly', async () => {
      render(
        <LoginForm
          onSuccess={mockOnSuccess}
          onError={mockOnError}
        />
      );

      // Submit with invalid data
      await userEvent.type(screen.getByLabelText(/email/i), invalidCredentials.email);
      await userEvent.type(screen.getByLabelText(/password/i), invalidCredentials.password);
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        const errors = screen.getAllByRole('alert');
        expect(errors).toHaveLength(2);
        expect(errors[0]).toHaveTextContent(/invalid email/i);
        expect(errors[1]).toHaveTextContent(/password must be/i);
      });
    });
  });

  describe('Theme Support', () => {
    it('should render with light theme styles', () => {
      render(
        <LoginForm
          onSuccess={mockOnSuccess}
          onError={mockOnError}
        />
      );

      const container = screen.getByTestId('login-form-container');
      expect(container).toHaveStyle({
        backgroundColor: '#FFFFFF',
        color: '#212529',
      });
    });

    it('should render with dark theme styles', () => {
      (useTheme as jest.Mock).mockReturnValue({
        theme: {
          mode: 'dark',
          colors: {
            background: '#111827',
            text: '#f9fafb',
            primary: '#3b82f6',
            error: '#ef4444',
          },
        },
        toggleTheme: mockToggleTheme,
      });

      render(
        <LoginForm
          onSuccess={mockOnSuccess}
          onError={mockOnError}
        />
      );

      const container = screen.getByTestId('login-form-container');
      expect(container).toHaveStyle({
        backgroundColor: '#111827',
        color: '#f9fafb',
      });
    });

    it('should handle theme prop override', () => {
      const customTheme = {
        mode: 'light',
        colors: {
          background: '#f0f0f0',
          text: '#000000',
          primary: '#ff0000',
          error: '#ff0000',
        },
      };

      render(
        <LoginForm
          onSuccess={mockOnSuccess}
          onError={mockOnError}
          theme={customTheme}
        />
      );

      const container = screen.getByTestId('login-form-container');
      expect(container).toHaveStyle({
        backgroundColor: '#f0f0f0',
        color: '#000000',
      });
    });
  });
});