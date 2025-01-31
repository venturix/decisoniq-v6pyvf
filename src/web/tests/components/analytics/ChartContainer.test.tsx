import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { expect, describe, it, beforeEach, afterEach } from '@jest/globals';
import { axe } from '@testing-library/jest-dom/extend-expect';
import { ThemeProvider } from '@mui/material';
import ChartContainer from '../../src/components/analytics/ChartContainer';
import { lightTheme, darkTheme } from '../../src/assets/styles/themes';

// Mock dependencies
jest.mock('../../src/components/common/Card', () => ({
  __esModule: true,
  default: ({ children, className, ...props }: any) => (
    <div className={`mock-card ${className}`} {...props}>
      {children}
    </div>
  ),
}));

jest.mock('../../src/components/common/Loading', () => ({
  __esModule: true,
  default: ({ text, testId }: any) => (
    <div data-testid={testId}>
      {text}
    </div>
  ),
}));

jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: lightTheme,
    setTheme: jest.fn(),
  }),
}));

jest.mock('../../src/hooks/useResizeObserver', () => ({
  useResizeObserver: () => ({
    width: 800,
    height: 600,
  }),
}));

describe('ChartContainer', () => {
  const defaultProps = {
    title: 'Test Chart',
    children: <div>Chart Content</div>,
  };

  beforeEach(() => {
    // Reset any runtime handlers
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any runtime changes
    jest.resetModules();
  });

  it('renders with accessibility features', async () => {
    const { container } = render(
      <ThemeProvider theme={lightTheme}>
        <ChartContainer {...defaultProps} />
      </ThemeProvider>
    );

    // Check ARIA attributes
    const chartRegion = screen.getByRole('region');
    expect(chartRegion).toHaveAttribute('aria-label', `Chart: ${defaultProps.title}`);

    // Verify heading hierarchy
    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading).toHaveTextContent(defaultProps.title);

    // Run accessibility audit
    const results = await axe(container);
    expect(results).toHaveNoViolations();

    // Verify keyboard navigation
    chartRegion.focus();
    expect(document.activeElement).toBe(chartRegion);
  });

  it('handles loading state correctly', () => {
    render(
      <ThemeProvider theme={lightTheme}>
        <ChartContainer {...defaultProps} loading={true} />
      </ThemeProvider>
    );

    // Verify loading indicator
    const loadingElement = screen.getByTestId('chart-loading');
    expect(loadingElement).toBeInTheDocument();
    expect(loadingElement).toHaveTextContent('Loading chart data...');

    // Verify content visibility during loading
    const chartContent = screen.queryByText('Chart Content');
    expect(chartContent).toBeInTheDocument(); // Content should still be rendered behind loading overlay
  });

  it('handles error state correctly', () => {
    const errorMessage = 'Failed to load chart data';
    render(
      <ThemeProvider theme={lightTheme}>
        <ChartContainer {...defaultProps} error={errorMessage} />
      </ThemeProvider>
    );

    // Verify error message
    const errorAlert = screen.getByRole('alert');
    expect(errorAlert).toHaveTextContent(errorMessage);
    expect(errorAlert).toHaveAttribute('aria-live', 'polite');

    // Verify content visibility during error
    const chartContent = screen.queryByText('Chart Content');
    expect(chartContent).not.toBeInTheDocument(); // Content should not be rendered during error
  });

  it('supports theme switching', () => {
    const { rerender } = render(
      <ThemeProvider theme={lightTheme}>
        <ChartContainer {...defaultProps} />
      </ThemeProvider>
    );

    // Verify light theme styles
    let container = screen.getByTestId('chart-container');
    expect(container).toHaveClass('chart-container');
    expect(container).not.toHaveClass('chart-container--high-contrast');

    // Switch to dark theme
    rerender(
      <ThemeProvider theme={darkTheme}>
        <ChartContainer {...defaultProps} />
      </ThemeProvider>
    );

    // Verify dark theme styles
    container = screen.getByTestId('chart-container');
    expect(container).toHaveClass('chart-container');
    expect(container.style.color).toBe(darkTheme.colors.text);
  });

  it('handles responsive behavior', async () => {
    const { rerender } = render(
      <ThemeProvider theme={lightTheme}>
        <ChartContainer {...defaultProps} height={400} />
      </ThemeProvider>
    );

    // Verify initial height
    const chartContent = screen.getByRole('region');
    expect(chartContent).toHaveStyle({ height: '400px' });

    // Simulate resize to mobile breakpoint
    window.innerWidth = 320;
    fireEvent(window, new Event('resize'));

    await waitFor(() => {
      expect(chartContent).toHaveStyle({ height: '300px' }); // Default mobile height
    });

    // Verify RTL support
    document.dir = 'rtl';
    rerender(
      <ThemeProvider theme={lightTheme}>
        <ChartContainer {...defaultProps} height={400} />
      </ThemeProvider>
    );

    expect(container.firstChild).toHaveStyle({ direction: 'rtl' });
  });

  it('suspends content loading appropriately', () => {
    const SuspendedContent = React.lazy(() => 
      Promise.resolve({ default: () => <div>Suspended Content</div> })
    );

    render(
      <ThemeProvider theme={lightTheme}>
        <ChartContainer {...defaultProps}>
          <SuspendedContent />
        </ChartContainer>
      </ThemeProvider>
    );

    // Verify loading fallback during suspension
    expect(screen.getByTestId('chart-loading')).toBeInTheDocument();
  });

  it('maintains ARIA live regions during updates', async () => {
    const { rerender } = render(
      <ThemeProvider theme={lightTheme}>
        <ChartContainer {...defaultProps} loading={true} />
      </ThemeProvider>
    );

    // Verify initial ARIA live region
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');

    // Update to error state
    rerender(
      <ThemeProvider theme={lightTheme}>
        <ChartContainer {...defaultProps} error="Error occurred" />
      </ThemeProvider>
    );

    // Verify error ARIA live region
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'polite');
    });
  });
});