import { faker } from '@faker-js/faker'; // v8.x
import { DeepPartial } from 'utility-types'; // v3.10.0
import { Customer, CustomerHealthScore } from '../../../web/src/types/customer';
import { CustomerTestData } from '../types/customer';
import { TestDataGenerator } from '../utils/test-data-generator';

/**
 * Pre-generated list of mock customers for common test scenarios
 */
export const mockCustomers: Customer[] = Array(10).fill(null).map(() => createMockCustomer({}));

/**
 * Creates a single mock customer with complete data and strict validation
 * @param overrides Optional partial customer data to override defaults
 * @returns Complete mock customer object with validated data
 */
export function createMockCustomer(overrides: DeepPartial<Customer> = {}): Customer {
  const contractStart = faker.date.future();
  const contractEnd = faker.date.future({ years: 2, refDate: contractStart });

  const customer: Customer = {
    id: faker.string.uuid(),
    name: faker.company.name(),
    contractStart,
    contractEnd,
    mrr: faker.number.float({ min: 1000, max: 100000, precision: 2 }),
    healthScore: faker.number.float({ min: 0, max: 100, precision: 1 }),
    riskProfile: {
      score: faker.number.float({ min: 0, max: 100, precision: 1 }),
      level: faker.helpers.arrayElement(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
      factors: Array(3).fill(null).map(() => ({
        name: faker.helpers.arrayElement(['Usage Decline', 'Support Issues', 'Payment Delays']),
        impact: faker.number.float({ min: 0, max: 1, precision: 2 }),
        category: faker.helpers.arrayElement(['USAGE', 'SUPPORT', 'FINANCIAL', 'PRODUCT_FIT']),
        trend: faker.helpers.arrayElement(['IMPROVING', 'STABLE', 'WORSENING']),
        details: {}
      })),
      trend: faker.helpers.arrayElement(['IMPROVING', 'STABLE', 'WORSENING']),
      lastAssessment: faker.date.recent()
    },
    metadata: {
      usageMetrics: {
        activeUsers: faker.number.int({ min: 10, max: 1000 }),
        featureAdoption: {
          core: faker.number.float({ min: 0, max: 1, precision: 2 }),
          advanced: faker.number.float({ min: 0, max: 1, precision: 2 })
        },
        lastLoginDate: faker.date.recent(),
        sessionDuration: faker.number.float({ min: 10, max: 120, precision: 1 }),
        apiUsage: faker.number.int({ min: 100, max: 10000 })
      },
      engagementMetrics: {
        lastInteraction: faker.date.recent(),
        interactionFrequency: faker.number.float({ min: 0, max: 10, precision: 1 }),
        npsScore: faker.number.int({ min: 0, max: 10 }),
        trainingCompletion: faker.number.float({ min: 0, max: 1, precision: 2 }),
        feedbackSentiment: faker.number.float({ min: -1, max: 1, precision: 2 })
      },
      supportMetrics: {
        openTickets: faker.number.int({ min: 0, max: 10 }),
        avgResolutionTime: faker.number.float({ min: 1, max: 72, precision: 1 }),
        criticalIssues: faker.number.int({ min: 0, max: 5 }),
        lastTicketDate: faker.date.recent(),
        satisfactionScore: faker.number.float({ min: 0, max: 1, precision: 2 })
      },
      financialMetrics: {
        totalRevenue: faker.number.float({ min: 10000, max: 1000000, precision: 2 }),
        lifetimeValue: faker.number.float({ min: 50000, max: 2000000, precision: 2 }),
        expansionOpportunities: faker.number.int({ min: 0, max: 5 }),
        paymentHistory: faker.number.float({ min: 0, max: 1, precision: 2 }),
        contractValue: faker.number.float({ min: 10000, max: 500000, precision: 2 })
      },
      customFields: {}
    },
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent()
  };

  return {
    ...customer,
    ...overrides
  };
}

/**
 * Creates a comprehensive mock health score for a customer with trend analysis
 * @param customerId Customer ID to generate health score for
 * @returns Mock health score data with factors and trends
 */
export function createMockCustomerHealthScore(customerId: string): CustomerHealthScore {
  return {
    score: faker.number.float({ min: 0, max: 100, precision: 1 }),
    factors: Array(3).fill(null).map(() => ({
      name: faker.helpers.arrayElement([
        'Product Usage',
        'Support Satisfaction',
        'Payment Reliability',
        'Engagement Level'
      ]),
      impact: faker.number.float({ min: 0, max: 1, precision: 2 }),
      category: faker.helpers.arrayElement(['USAGE', 'SUPPORT', 'FINANCIAL', 'PRODUCT_FIT']),
      trend: faker.helpers.arrayElement(['IMPROVING', 'STABLE', 'WORSENING']),
      details: {
        lastMeasurement: faker.date.recent(),
        confidence: faker.number.float({ min: 0.7, max: 1, precision: 2 }),
        historicalData: Array(6).fill(null).map(() => ({
          date: faker.date.recent(),
          value: faker.number.float({ min: 0, max: 100, precision: 1 })
        }))
      }
    }))
  };
}

/**
 * Creates a paginated array of mock customers with sorting and filtering
 * @param count Number of customers to generate
 * @param options Optional sorting and filtering options
 * @returns Array of mock customers with pagination metadata
 */
export function createMockCustomerList(
  count: number,
  options: {
    sortBy?: keyof Customer;
    sortOrder?: 'asc' | 'desc';
    filterBy?: Partial<Customer>;
  } = {}
): { customers: Customer[]; total: number; page: number; pageSize: number } {
  const customers = Array(count)
    .fill(null)
    .map(() => createMockCustomer({}));

  if (options.sortBy) {
    customers.sort((a, b) => {
      const aVal = a[options.sortBy!];
      const bVal = b[options.sortBy!];
      return options.sortOrder === 'desc' ? 
        (bVal > aVal ? 1 : -1) : 
        (aVal > bVal ? 1 : -1);
    });
  }

  if (options.filterBy) {
    Object.entries(options.filterBy).forEach(([key, value]) => {
      if (value !== undefined) {
        customers.filter(customer => customer[key as keyof Customer] === value);
      }
    });
  }

  return {
    customers,
    total: customers.length,
    page: 1,
    pageSize: count
  };
}