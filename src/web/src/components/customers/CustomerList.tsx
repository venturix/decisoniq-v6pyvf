import React, { useCallback, useEffect, useMemo, useState } from 'react'; // ^18.0.0
import { Card, Badge, Tooltip } from '@blitzy/premium-ui'; // ^2.0.0
import { useAnalytics } from '@blitzy/analytics'; // ^1.5.0
import { useCustomerData } from '@blitzy/data-hooks'; // ^1.0.0
import debounce from 'lodash/debounce'; // ^4.17.21

import { Table } from '../common/Table';
import { useTheme } from '../../hooks/useTheme';
import type { Customer, CustomerRiskLevel, CustomerSortField } from '../../types/customer';

// Constants for component configuration
const DEFAULT_PAGE_SIZE = 25;
const DEFAULT_SORT_FIELD = CustomerSortField.HEALTH_SCORE;
const RETRY_ATTEMPTS = 3;
const CACHE_TTL = 300000; // 5 minutes in milliseconds

interface CustomerListProps {
  onCustomerSelect?: (customer: Customer) => void;
  className?: string;
  tenantId: string;
}

export const CustomerList: React.FC<CustomerListProps> = ({
  onCustomerSelect,
  className,
  tenantId,
}) => {
  const { theme } = useTheme();
  const { trackEvent } = useAnalytics();
  const { fetchCustomers, isLoading, error } = useCustomerData();

  // Component state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [sortField, setSortField] = useState(DEFAULT_SORT_FIELD);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Risk level color mapping based on theme
  const getRiskLevelColor = useCallback((level: CustomerRiskLevel) => {
    switch (level) {
      case CustomerRiskLevel.CRITICAL:
        return theme.colors.riskHigh;
      case CustomerRiskLevel.HIGH:
        return theme.colors.warning;
      case CustomerRiskLevel.MEDIUM:
        return theme.colors.info;
      default:
        return theme.colors.success;
    }
  }, [theme]);

  // Table columns configuration
  const columns = useMemo(() => [
    {
      id: 'name',
      header: 'Customer Name',
      sortable: true,
      width: '25%',
      render: (customer: Customer) => (
        <div
          className="cs-customer-name"
          onClick={() => handleCustomerClick(customer)}
          role="button"
          tabIndex={0}
        >
          {customer.name}
        </div>
      ),
    },
    {
      id: 'healthScore',
      header: 'Health Score',
      sortable: true,
      width: '15%',
      render: (customer: Customer) => (
        <Tooltip content={`Based on ${customer.metadata.usageMetrics.activeUsers} active users`}>
          <div className="cs-health-score">
            {customer.healthScore}%
          </div>
        </Tooltip>
      ),
    },
    {
      id: 'riskLevel',
      header: 'Risk Level',
      sortable: true,
      width: '15%',
      render: (customer: Customer) => (
        <Badge
          color={getRiskLevelColor(customer.riskProfile.level)}
          label={customer.riskProfile.level}
          tooltip={`${customer.riskProfile.factors.length} risk factors identified`}
        />
      ),
    },
    {
      id: 'mrr',
      header: 'MRR',
      sortable: true,
      width: '15%',
      render: (customer: Customer) => (
        <div className="cs-mrr">
          ${customer.mrr.toLocaleString()}
        </div>
      ),
    },
    {
      id: 'contractEnd',
      header: 'Contract End',
      sortable: true,
      width: '15%',
      render: (customer: Customer) => (
        <div className="cs-contract-end">
          {new Date(customer.contractEnd).toLocaleDateString()}
        </div>
      ),
    },
    {
      id: 'lastUpdated',
      header: 'Last Updated',
      sortable: true,
      width: '15%',
      render: (customer: Customer) => (
        <div className="cs-last-updated">
          {new Date(customer.updatedAt).toLocaleString()}
        </div>
      ),
    },
  ], [getRiskLevelColor, handleCustomerClick]);

  // Handle customer selection
  const handleCustomerClick = useCallback((customer: Customer) => {
    trackEvent('customer_selected', {
      customerId: customer.id,
      riskLevel: customer.riskProfile.level,
    });
    onCustomerSelect?.(customer);
  }, [onCustomerSelect, trackEvent]);

  // Handle sort changes with debouncing
  const handleSort = useCallback(
    debounce(async (field: string, direction: 'asc' | 'desc') => {
      try {
        trackEvent('customer_list_sort', { field, direction });
        setSortField(field as CustomerSortField);
        setSortDirection(direction);
        
        const response = await fetchCustomers({
          page: currentPage,
          pageSize: DEFAULT_PAGE_SIZE,
          sortField: field,
          sortDirection: direction,
          tenantId,
        });

        setCustomers(response.data);
        setTotalItems(response.total);
      } catch (err) {
        console.error('Error sorting customers:', err);
      }
    }, 300),
    [currentPage, fetchCustomers, tenantId, trackEvent]
  );

  // Handle page changes
  const handlePageChange = useCallback(async (page: number) => {
    try {
      trackEvent('customer_list_page_change', { page });
      setCurrentPage(page);

      const response = await fetchCustomers({
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        sortField,
        sortDirection,
        tenantId,
      });

      setCustomers(response.data);
      setTotalItems(response.total);
    } catch (err) {
      console.error('Error changing page:', err);
    }
  }, [fetchCustomers, sortField, sortDirection, tenantId, trackEvent]);

  // Initial data fetch
  useEffect(() => {
    let attempts = 0;
    const fetchData = async () => {
      try {
        const response = await fetchCustomers({
          page: currentPage,
          pageSize: DEFAULT_PAGE_SIZE,
          sortField,
          sortDirection,
          tenantId,
        });

        setCustomers(response.data);
        setTotalItems(response.total);
      } catch (err) {
        if (attempts < RETRY_ATTEMPTS) {
          attempts++;
          setTimeout(fetchData, 1000 * attempts);
        }
      }
    };

    fetchData();
  }, [fetchCustomers, tenantId]);

  return (
    <Card
      className={className}
      aria-label="Customer List"
      data-testid="customer-list"
    >
      <Table
        data={customers}
        columns={columns}
        isLoading={isLoading}
        totalItems={totalItems}
        currentPage={currentPage}
        pageSize={DEFAULT_PAGE_SIZE}
        onSort={handleSort}
        onPageChange={handlePageChange}
        accessibility={{
          ariaLabel: 'Customer list table',
          ariaLabelSort: 'Click to sort by this column',
        }}
        highContrast={theme.mode === 'high-contrast'}
      />
      {error && (
        <div
          className="cs-error-message"
          role="alert"
          aria-live="polite"
        >
          Error loading customers. Please try again.
        </div>
      )}
    </Card>
  );
};

export default CustomerList;