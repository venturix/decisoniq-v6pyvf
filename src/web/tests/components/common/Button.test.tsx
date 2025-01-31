import React from 'react';
import { render, fireEvent, screen, within } from '@testing-library/react'; // ^14.0.0
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'; // ^29.0.0
import { axe, toHaveNoViolations } from '@axe-core/react'; // ^4.7.0
import { ThemeProvider } from '@mui/material'; // ^5.0.0
import Button from '../../../src/components/common/Button';
import lightTheme from '../../../src/assets/styles/themes/light';
import darkTheme from '../../../src/assets/styles/themes/dark';

expect.extend(toHaveNoViolations);

// Helper function to render button with theme context
const renderWithTheme = (ui: React.ReactNode, theme = lightTheme) => {
  return render(
    <ThemeProvider theme={theme}>
      {ui}
    </ThemeProvider>
  );
};

describe('Button Component', () => {
  // Clean up after each test
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders with default props', () => {
      renderWithTheme(<Button>Click me</Button>);
      const button = screen.getByRole('button', { name: /click me/i });
      
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('blitzy-button', 'blitzy-button--primary', 'blitzy-button--medium');
    });

    it('renders all variant styles correctly', () => {
      const variants = ['primary', 'secondary', 'tertiary', 'danger'] as const;
      
      variants.forEach(variant => {
        const { rerender } = renderWithTheme(
          <Button variant={variant}>Button</Button>
        );
        
        const button = screen.getByRole('button');
        expect(button).toHaveClass(`blitzy-button--${variant}`);
        rerender(<></>);
      });
    });

    it('renders all size options correctly', () => {
      const sizes = ['small', 'medium', 'large'] as const;
      
      sizes.forEach(size => {
        const { rerender } = renderWithTheme(
          <Button size={size}>Button</Button>
        );
        
        const button = screen.getByRole('button');
        expect(button).toHaveClass(`blitzy-button--${size}`);
        rerender(<></>);
      });
    });

    it('renders with full width when specified', () => {
      renderWithTheme(<Button fullWidth>Full Width</Button>);
      const button = screen.getByRole('button');
      
      expect(button).toHaveClass('blitzy-button--full-width');
      expect(button).toHaveStyle({ width: '100%' });
    });

    it('renders with icons in correct positions', () => {
      const testIcon = <span data-testid="test-icon">★</span>;
      
      const { rerender } = renderWithTheme(
        <Button icon={testIcon} iconPosition="left">With Icon</Button>
      );
      
      let button = screen.getByRole('button');
      let icon = within(button).getByTestId('test-icon');
      expect(icon).toBeInTheDocument();
      expect(button).toHaveClass('blitzy-button--icon-left');
      
      rerender(
        <ThemeProvider theme={lightTheme}>
          <Button icon={testIcon} iconPosition="right">With Icon</Button>
        </ThemeProvider>
      );
      
      button = screen.getByRole('button');
      icon = within(button).getByTestId('test-icon');
      expect(icon).toBeInTheDocument();
      expect(button).toHaveClass('blitzy-button--icon-right');
    });
  });

  describe('Interaction', () => {
    it('handles click events', () => {
      const handleClick = jest.fn();
      renderWithTheme(<Button onClick={handleClick}>Click me</Button>);
      
      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('prevents interaction when disabled', () => {
      const handleClick = jest.fn();
      renderWithTheme(<Button disabled onClick={handleClick}>Disabled</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      fireEvent.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('shows loading state correctly', () => {
      renderWithTheme(<Button loading>Loading</Button>);
      
      const button = screen.getByRole('button');
      const spinner = within(button).getByRole('status');
      
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(spinner).toHaveAttribute('aria-label', 'Loading');
      expect(button).toBeDisabled();
    });

    it('handles keyboard navigation', () => {
      const handleClick = jest.fn();
      renderWithTheme(<Button onClick={handleClick}>Press me</Button>);
      
      const button = screen.getByRole('button');
      button.focus();
      expect(button).toHaveFocus();
      
      fireEvent.keyDown(button, { key: 'Enter' });
      expect(handleClick).toHaveBeenCalledTimes(1);
      
      fireEvent.keyDown(button, { key: ' ' });
      expect(handleClick).toHaveBeenCalledTimes(2);
    });
  });

  describe('Accessibility', () => {
    it('meets WCAG accessibility guidelines', async () => {
      const { container } = renderWithTheme(
        <Button>Accessible Button</Button>
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('provides proper ARIA attributes', () => {
      renderWithTheme(<Button loading disabled>Loading State</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });

    it('maintains sufficient color contrast', async () => {
      const { container } = renderWithTheme(
        <>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="tertiary">Tertiary</Button>
          <Button variant="danger">Danger</Button>
        </>
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Theme Integration', () => {
    it('applies light theme styles correctly', () => {
      renderWithTheme(<Button>Light Theme</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveStyle({
        backgroundColor: lightTheme.colors.primary,
        color: lightTheme.colors.background
      });
    });

    it('applies dark theme styles correctly', () => {
      renderWithTheme(<Button>Dark Theme</Button>, darkTheme);
      
      const button = screen.getByRole('button');
      expect(button).toHaveStyle({
        backgroundColor: darkTheme.colors.primary,
        color: darkTheme.colors.background
      });
    });

    it('handles high contrast mode', () => {
      renderWithTheme(<Button highContrast>High Contrast</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('blitzy-button--high-contrast');
    });

    it('applies custom brand colors', () => {
      const customTheme = {
        ...lightTheme,
        colors: {
          ...lightTheme.colors,
          primary: '#custom-color'
        }
      };
      
      renderWithTheme(<Button>Custom Brand</Button>, customTheme);
      
      const button = screen.getByRole('button');
      expect(button).toHaveStyle({
        backgroundColor: '#custom-color'
      });
    });
  });
});