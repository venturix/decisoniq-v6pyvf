import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { jest } from '@jest/globals';
import { axe } from '@axe-core/react'; // ^4.7.0

// Component under test
import KPIOverview from '../../../src/components/dashboard/KPIOverview';

// Test utilities and mock data
import { mockMetrics } from '../../../test/src/mocks/metrics';
import { TestFixtureManager } from '../../../test/src/utils/test-fixtures';

describe('KPIOverview Component', () => {
  let fixtureManager: TestFixtureManager;
  let mockOnMetricUpdate: jest.Mock;

  beforeEach(async () => {
    // Initialize test fixture and mock data
    fixtureManager = TestFixtureManager.getInstance();
    await fixtureManager.createFixture('kpi-overview', 'development');

    // Setup mock functions
    mockOnMetricUpdate = jest.fn();

    // Mock API responses
    jest.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          data: {
            churnReduction: {
              current: 25,
              target: 30,
              trend: 5
            },
            revenueImpact: {
              current: 12,
              target: 15,
              trend: 3
            },
            operationalEfficiency: {
              current: 35,
              target: 40,
              trend: 8
            }
          }
        })
      } as Response)
    );
  });

  afterEach(async () => {
    // Cleanup test fixtures and mocks
    await fixtureManager.teardownFixture('kpi-overview');
    jest.clearAllMocks();
  });

  it('renders KPI cards with correct metrics and formatting', async () => {
    // Render component with default props
    render(
      <KPIOverview
        refreshInterval={300000}
        onMetricUpdate={mockOnMetricUpdate}
      />
    );

    // Wait for metrics to load
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    // Verify churn reduction KPI
    const churnCard = screen.getByText(/Churn Reduction/i).closest('[role="region"]');
    expect(churnCard).toBeInTheDocument();
    expect(within(churnCard!).getByText('25%')).toBeInTheDocument();
    expect(within(churnCard!).getByText('Target: 30%')).toBeInTheDocument();

    // Verify revenue impact KPI
    const revenueCard = screen.getByText(/Revenue Impact/i).closest('[role="region"]');
    expect(revenueCard).toBeInTheDocument();
    expect(within(revenueCard!).getByText('12%')).toBeInTheDocument();
    expect(within(revenueCard!).getByText('Target: 15%')).toBeInTheDocument();

    // Verify operational efficiency KPI
    const efficiencyCard = screen.getByText(/Operational Efficiency/i).closest('[role="region"]');
    expect(efficiencyCard).toBeInTheDocument();
    expect(within(efficiencyCard!).getByText('35%')).toBeInTheDocument();
    expect(within(efficiencyCard!).getByText('Target: 40%')).toBeInTheDocument();

    // Verify trend indicators
    expect(screen.getAllByRole('img', { name: /trend/i })).toHaveLength(3);
  });

  it('updates metrics based on refresh interval', async () => {
    jest.useFakeTimers();

    // Render component with 5-second refresh interval
    render(
      <KPIOverview
        refreshInterval={5000}
        onMetricUpdate={mockOnMetricUpdate}
      />
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    // Mock updated metrics after interval
    global.fetch = jest.fn().mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          data: {
            churnReduction: {
              current: 28,
              target: 30,
              trend: 7
            }
          }
        })
      } as Response)
    );

    // Advance timers and verify update
    jest.advanceTimersByTime(5000);

    await waitFor(() => {
      expect(mockOnMetricUpdate).toHaveBeenCalled();
      expect(screen.getByText('28%')).toBeInTheDocument();
    });

    jest.useRealTimers();
  });

  it('handles loading state correctly', async () => {
    // Mock delayed API response
    global.fetch = jest.fn().mockImplementationOnce(() =>
      new Promise(resolve =>
        setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockMetrics.validHealthScores })
        } as Response), 2000)
      )
    );

    render(<KPIOverview refreshInterval={300000} />);

    // Verify loading skeleton
    const loadingElement = screen.getByRole('status', { name: /loading metrics/i });
    expect(loadingElement).toBeInTheDocument();
    expect(loadingElement.getElementsByClassName('animate-pulse')).toHaveLength(4);

    // Verify content appears after loading
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.getAllByRole('region')).toHaveLength(3);
    });
  });

  it('handles error state and retry functionality', async () => {
    // Mock API error
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Failed to fetch metrics'));

    render(<KPIOverview refreshInterval={300000} />);

    // Verify error message
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Failed to fetch metrics/i)).toBeInTheDocument();
    });

    // Mock successful retry
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: mockMetrics.validHealthScores })
    } as Response);

    // Click retry button and verify recovery
    fireEvent.click(screen.getByText(/retry/i));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getAllByRole('region')).toHaveLength(3);
    });
  });

  it('meets accessibility standards', async () => {
    const { container } = render(
      <KPIOverview
        refreshInterval={300000}
        onMetricUpdate={mockOnMetricUpdate}
      />
    );

    // Wait for content to load
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    // Run accessibility tests
    const results = await axe(container);
    expect(results).toHaveNoViolations();

    // Verify specific accessibility features
    expect(screen.getByRole('region', { name: /key performance indicators/i }))
      .toBeInTheDocument();
    expect(screen.getAllByRole('region')).toHaveLength(3);
    
    // Verify trend indicators have proper ARIA labels
    const trendLabels = screen.getAllByLabelText(/improving|declining|stable/i);
    expect(trendLabels.length).toBeGreaterThan(0);
  });

  it('handles high contrast mode correctly', async () => {
    render(
      <KPIOverview
        refreshInterval={300000}
        highContrastMode={true}
      />
    );

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    // Verify high contrast styles are applied
    const cards = screen.getAllByRole('region');
    cards.forEach(card => {
      expect(card).toHaveClass('high-contrast');
    });
  });
});