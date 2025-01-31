import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { performance } from 'jest-performance';
import { jest } from '@jest/globals';
import { Provider } from 'react-redux';
import { ThemeProvider } from '../../../src/lib/blitzy/theme';
import Dashboard from '../../../src/pages/analytics/Dashboard';
import { PERFORMANCE_THRESHOLDS } from '../../../src/config/constants';

// Mock dependencies
jest.mock('../../../src/lib/api/metrics');
jest.mock('../../../src/hooks/useTheme');
jest.mock('../../../src/components/dashboard/KPIOverview');
jest.mock('../../../src/components/dashboard/ActivityFeed');
jest.mock('../../../src/components/dashboard/QuickActions');
jest.mock('../../../src/components/dashboard/RecentAlerts');

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

describe('Analytics Dashboard', () => {
  // Mock data
  const mockUserRole = 'CS_MANAGER';
  const mockRefreshIntervals = {
    kpi: 300000,
    activities: 30000,
    alerts: 60000
  };

  // Mock API responses
  const mockMetrics = {
    getAggregatedMetrics: jest.fn(),
    getMetricHistory: jest.fn(),
    getMetricTrends: jest.fn(),
    subscribeToUpdates: jest.fn()
  };

  // Mock activity feed data
  const mockActivityFeed = {
    getRecentActivities: jest.fn(),
    markAsRead: jest.fn(),
    subscribeToUpdates: jest.fn()
  };

  // Mock alerts data
  const mockAlerts = {
    getRecentAlerts: jest.fn(),
    dismissAlert: jest.fn(),
    subscribeToAlerts: jest.fn()
  };

  // Performance monitoring mock
  const mockPerformanceMonitor = {
    measureRenderTime: jest.fn(),
    trackMetricUpdate: jest.fn(),
    reportPerformance: jest.fn()
  };

  beforeAll(() => {
    // Configure performance monitoring
    performance.monitor({
      maxExecutionTime: PERFORMANCE_THRESHOLDS.PAGE_LOAD_TIME,
      maxHeapUsage: 50 * 1024 * 1024 // 50MB
    });
  });

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Setup default mock responses
    mockMetrics.getAggregatedMetrics.mockResolvedValue({
      data: { churnRate: 0.15, revenueImpact: 1200000 }
    });
    
    mockActivityFeed.getRecentActivities.mockResolvedValue({
      data: [{ id: '1', type: 'interaction', timestamp: new Date() }]
    });
    
    mockAlerts.getRecentAlerts.mockResolvedValue({
      data: [{ id: '1', severity: 'high', message: 'Test alert' }]
    });
  });

  it('renders within performance thresholds', async () => {
    const startTime = performance.now();

    render(
      <Provider store={mockStore}>
        <ThemeProvider>
          <Dashboard userRole={mockUserRole} refreshIntervals={mockRefreshIntervals} />
        </ThemeProvider>
      </Provider>
    );

    const renderTime = performance.now() - startTime;
    expect(renderTime).toBeLessThan(PERFORMANCE_THRESHOLDS.PAGE_LOAD_TIME);
    expect(mockPerformanceMonitor.measureRenderTime).toHaveBeenCalled();
  });

  it('meets accessibility requirements', async () => {
    const { container } = render(
      <Provider store={mockStore}>
        <ThemeProvider>
          <Dashboard userRole={mockUserRole} refreshIntervals={mockRefreshIntervals} />
        </ThemeProvider>
      </Provider>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('handles real-time metric updates correctly', async () => {
    const { rerender } = render(
      <Provider store={mockStore}>
        <ThemeProvider>
          <Dashboard userRole={mockUserRole} refreshIntervals={mockRefreshIntervals} />
        </ThemeProvider>
      </Provider>
    );

    // Simulate metric update
    act(() => {
      mockMetrics.subscribeToUpdates.mock.calls[0][0]({
        churnRate: 0.12,
        revenueImpact: 1300000
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('kpi-overview')).toHaveTextContent('12%');
      expect(mockPerformanceMonitor.trackMetricUpdate).toHaveBeenCalled();
    });
  });

  it('handles error states appropriately', async () => {
    // Simulate API error
    mockMetrics.getAggregatedMetrics.mockRejectedValue(new Error('API Error'));

    render(
      <Provider store={mockStore}>
        <ThemeProvider>
          <Dashboard userRole={mockUserRole} refreshIntervals={mockRefreshIntervals} />
        </ThemeProvider>
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Error loading metrics/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  it('maintains performance during continuous updates', async () => {
    const updateCount = 10;
    const updates = Array.from({ length: updateCount }, (_, i) => ({
      churnRate: 0.15 - (i * 0.01),
      revenueImpact: 1200000 + (i * 100000)
    }));

    render(
      <Provider store={mockStore}>
        <ThemeProvider>
          <Dashboard userRole={mockUserRole} refreshIntervals={mockRefreshIntervals} />
        </ThemeProvider>
      </Provider>
    );

    for (const update of updates) {
      act(() => {
        mockMetrics.subscribeToUpdates.mock.calls[0][0](update);
      });

      await waitFor(() => {
        expect(mockPerformanceMonitor.trackMetricUpdate).toHaveBeenCalled();
      });
    }

    expect(mockPerformanceMonitor.reportPerformance).toHaveBeenCalledTimes(updateCount);
  });

  it('handles component unmounting and cleanup', () => {
    const { unmount } = render(
      <Provider store={mockStore}>
        <ThemeProvider>
          <Dashboard userRole={mockUserRole} refreshIntervals={mockRefreshIntervals} />
        </ThemeProvider>
      </Provider>
    );

    unmount();

    expect(mockMetrics.subscribeToUpdates).toHaveBeenCalled();
    expect(mockActivityFeed.subscribeToUpdates).toHaveBeenCalled();
    expect(mockAlerts.subscribeToAlerts).toHaveBeenCalled();
  });

  it('supports keyboard navigation', async () => {
    render(
      <Provider store={mockStore}>
        <ThemeProvider>
          <Dashboard userRole={mockUserRole} refreshIntervals={mockRefreshIntervals} />
        </ThemeProvider>
      </Provider>
    );

    const user = userEvent.setup();
    
    // Tab through interactive elements
    await user.tab();
    expect(screen.getByTestId('kpi-overview')).toHaveFocus();
    
    await user.tab();
    expect(screen.getByTestId('quick-actions')).toHaveFocus();
    
    await user.tab();
    expect(screen.getByTestId('activity-feed')).toHaveFocus();
  });

  it('validates data quality indicators', async () => {
    render(
      <Provider store={mockStore}>
        <ThemeProvider>
          <Dashboard userRole={mockUserRole} refreshIntervals={mockRefreshIntervals} />
        </ThemeProvider>
      </Provider>
    );

    await waitFor(() => {
      const kpiOverview = screen.getByTestId('kpi-overview');
      expect(kpiOverview).toHaveAttribute('data-quality', 'high');
    });
  });

  it('handles theme changes correctly', async () => {
    const { rerender } = render(
      <Provider store={mockStore}>
        <ThemeProvider>
          <Dashboard userRole={mockUserRole} refreshIntervals={mockRefreshIntervals} />
        </ThemeProvider>
      </Provider>
    );

    // Simulate theme change
    act(() => {
      mockTheme.setTheme({ mode: 'dark' });
    });

    rerender(
      <Provider store={mockStore}>
        <ThemeProvider>
          <Dashboard userRole={mockUserRole} refreshIntervals={mockRefreshIntervals} />
        </ThemeProvider>
      </Provider>
    );

    expect(screen.getByTestId('dashboard-container')).toHaveClass('dark');
  });
});