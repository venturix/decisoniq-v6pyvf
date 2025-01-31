import React from 'react'; // ^18.0.0
import { render, screen, waitFor, act } from '@testing-library/react'; // ^14.0.0
import userEvent from '@testing-library/user-event'; // ^14.0.0
import { axe, toHaveNoViolations } from 'jest-axe'; // ^7.0.0
import { setupServer } from 'msw/node'; // ^1.0.0
import { rest } from 'msw'; // ^1.0.0

import CustomerDetails from '../../../src/components/customers/CustomerDetails';
import { useCustomer } from '../../../src/hooks/useCustomer';
import type { Customer, CustomerRiskLevel } from '../../../src/types/customer';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock the useCustomer hook
jest.mock('../../../src/hooks/useCustomer');
const mockUseCustomer = useCustomer as jest.MockedFunction<typeof useCustomer>;

// Mock WebSocket
class MockWebSocket {
  onmessage: ((event: MessageEvent) => void) | null = null;
  send = jest.fn();
  close = jest.fn();
  addEventListener = jest.fn();
  removeEventListener = jest.fn();
}

// Test data
const mockCustomer: Customer = {
  id: 'test-customer-1',
  name: 'Test Customer Corp',
  healthScore: 85,
  riskProfile: {
    score: 25,
    level: CustomerRiskLevel.LOW,
    factors: [
      {
        name: 'usage_decline',
        impact: 15,
        category: 'USAGE',
        trend: 'STABLE',
        details: {}
      }
    ],
    trend: 'STABLE',
    lastAssessment: new Date()
  },
  metadata: {
    usageMetrics: {
      activeUsers: 150,
      featureAdoption: { core: 75 },
      lastLoginDate: new Date(),
      sessionDuration: 45,
      apiUsage: 1000
    },
    engagementMetrics: {
      lastInteraction: new Date(),
      interactionFrequency: 0.8,
      npsScore: 8,
      trainingCompletion: 90,
      feedbackSentiment: 0.75
    },
    supportMetrics: {
      openTickets: 2,
      avgResolutionTime: 24,
      criticalIssues: 0,
      satisfactionScore: 0.9
    },
    financialMetrics: {
      totalRevenue: 50000,
      lifetimeValue: 150000,
      expansionOpportunities: 2,
      paymentHistory: 1,
      contractValue: 10000
    },
    customFields: {}
  },
  contractStart: new Date('2023-01-01'),
  contractEnd: new Date('2024-01-01'),
  mrr: 10000,
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date()
};

// MSW Server setup
const server = setupServer(
  rest.get('/api/customers/:customerId', (req, res, ctx) => {
    return res(ctx.json({ data: mockCustomer }));
  })
);

describe('CustomerDetails', () => {
  // Setup before all tests
  beforeAll(() => {
    server.listen();
    // Mock WebSocket
    global.WebSocket = MockWebSocket as any;
  });

  // Setup before each test
  beforeEach(() => {
    mockUseCustomer.mockReturnValue({
      selectedCustomer: mockCustomer,
      healthScore: 85,
      refreshHealthScore: jest.fn(),
      loading: false,
      error: null,
      selectCustomerById: jest.fn()
    });
  });

  // Cleanup after each test
  afterEach(() => {
    server.resetHandlers();
    jest.clearAllMocks();
  });

  // Cleanup after all tests
  afterAll(() => {
    server.close();
  });

  it('renders customer information correctly', () => {
    render(<CustomerDetails customerId="test-customer-1" />);

    expect(screen.getByText('Test Customer Corp')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('low')).toBeInTheDocument();
  });

  it('displays loading state correctly', () => {
    mockUseCustomer.mockReturnValueOnce({
      selectedCustomer: null,
      healthScore: null,
      refreshHealthScore: jest.fn(),
      loading: true,
      error: null,
      selectCustomerById: jest.fn()
    });

    render(<CustomerDetails customerId="test-customer-1" />);
    
    expect(screen.getByRole('alert')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByLabelText('Loading customer details')).toBeInTheDocument();
  });

  it('updates health score within performance requirements', async () => {
    const refreshHealthScore = jest.fn();
    mockUseCustomer.mockReturnValue({
      selectedCustomer: mockCustomer,
      healthScore: 85,
      refreshHealthScore,
      loading: false,
      error: null,
      selectCustomerById: jest.fn()
    });

    const { rerender } = render(<CustomerDetails customerId="test-customer-1" />);

    // Simulate WebSocket health score update
    act(() => {
      const ws = new MockWebSocket();
      ws.onmessage?.({ data: JSON.stringify({ score: 90 }) } as MessageEvent);
    });

    await waitFor(() => {
      expect(refreshHealthScore).toHaveBeenCalledWith('test-customer-1');
    }, { timeout: 3000 }); // Ensure update within 3s requirement
  });

  it('handles error states appropriately', () => {
    const onError = jest.fn();
    const error = new Error('Failed to load customer data');
    
    mockUseCustomer.mockReturnValue({
      selectedCustomer: null,
      healthScore: null,
      refreshHealthScore: jest.fn(),
      loading: false,
      error,
      selectCustomerById: jest.fn()
    });

    render(<CustomerDetails customerId="test-customer-1" onError={onError} />);

    expect(onError).toHaveBeenCalledWith(error);
  });

  it('meets accessibility requirements', async () => {
    const { container } = render(<CustomerDetails customerId="test-customer-1" />);
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('displays risk factors with correct severity indicators', () => {
    render(<CustomerDetails customerId="test-customer-1" />);

    const riskFactors = screen.getByLabelText('Risk factors');
    expect(riskFactors).toBeInTheDocument();
    
    mockCustomer.riskProfile.factors.forEach(factor => {
      const factorElement = screen.getByLabelText(
        `${factor.name} risk factor with ${factor.impact} impact`
      );
      expect(factorElement).toBeInTheDocument();
      expect(factorElement).toHaveClass(`risk-factor-item risk-${factor.category.toLowerCase()}`);
    });
  });

  it('handles real-time updates via WebSocket', async () => {
    const selectCustomerById = jest.fn();
    mockUseCustomer.mockReturnValue({
      selectedCustomer: mockCustomer,
      healthScore: 85,
      refreshHealthScore: jest.fn(),
      loading: false,
      error: null,
      selectCustomerById
    });

    render(<CustomerDetails customerId="test-customer-1" />);

    // Simulate risk profile update
    act(() => {
      const ws = new MockWebSocket();
      ws.onmessage?.({ data: JSON.stringify({ type: 'risk-profile-update' }) } as MessageEvent);
    });

    await waitFor(() => {
      expect(selectCustomerById).toHaveBeenCalledWith('test-customer-1');
    });
  });

  it('follows Blitzy Enterprise Design System specifications', () => {
    render(<CustomerDetails customerId="test-customer-1" />);

    // Verify color variables usage
    const healthScore = screen.getByLabelText(/health score of/);
    expect(healthScore).toHaveStyle({ color: 'var(--color-success-600)' });

    // Verify typography classes
    expect(screen.getByText('Test Customer Corp')).toHaveClass('text-2xl font-bold');
  });

  it('supports keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<CustomerDetails customerId="test-customer-1" />);

    const metricsSection = screen.getByLabelText('Usage metrics');
    await user.tab();
    expect(metricsSection).toHaveFocus();
  });
});