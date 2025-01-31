import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, FilterGroup, DateRangePicker } from '@blitzy/premium-ui'; // ^2.0.0
import { debounce } from 'lodash'; // ^4.17.21
import dayjs from 'dayjs'; // ^1.11.0
import ReactPaginate from 'react-paginate'; // ^8.2.0
import { Table } from '../common/Table';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { useTheme } from '../../hooks/useTheme';

// Types for interaction data
interface CustomerInteraction {
  id: string;
  type: InteractionType;
  date: string;
  owner: {
    id: string;
    name: string;
  };
  status: InteractionStatus;
  description: string;
  metadata: Record<string, any>;
}

type InteractionType = 'meeting' | 'support' | 'playbook' | 'training' | 'other';
type InteractionStatus = 'completed' | 'scheduled' | 'cancelled' | 'in_progress';

// Props interface
interface InteractionHistoryProps {
  customerId: string;
  pageSize?: number;
  className?: string;
  onInteractionSelect?: (interaction: CustomerInteraction) => void;
  initialFilters?: InteractionFilters;
}

// Filter interface
interface InteractionFilters {
  dateRange: {
    start: Date;
    end: Date;
  };
  types: InteractionType[];
  status: InteractionStatus[];
  owners: string[];
}

// Default filters
const defaultFilters: InteractionFilters = {
  dateRange: {
    start: dayjs().subtract(30, 'days').toDate(),
    end: new Date(),
  },
  types: [],
  status: [],
  owners: [],
};

// Debounced fetch function
const fetchInteractions = debounce(async (
  customerId: string,
  params: {
    page: number;
    pageSize: number;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
    filters: InteractionFilters;
  }
): Promise<{ data: CustomerInteraction[]; total: number }> => {
  try {
    const queryParams = new URLSearchParams({
      customerId,
      page: params.page.toString(),
      pageSize: params.pageSize.toString(),
      sortBy: params.sortBy || 'date',
      sortDir: params.sortDir || 'desc',
      startDate: dayjs(params.filters.dateRange.start).format('YYYY-MM-DD'),
      endDate: dayjs(params.filters.dateRange.end).format('YYYY-MM-DD'),
      types: params.filters.types.join(','),
      status: params.filters.status.join(','),
      owners: params.filters.owners.join(','),
    });

    const response = await fetch(`/api/v1/interactions?${queryParams}`);
    if (!response.ok) throw new Error('Failed to fetch interactions');
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching interactions:', error);
    throw error;
  }
}, 300);

export const InteractionHistory: React.FC<InteractionHistoryProps> = ({
  customerId,
  pageSize = 10,
  className,
  onInteractionSelect,
  initialFilters,
}) => {
  const { theme } = useTheme();
  const [interactions, setInteractions] = useState<CustomerInteraction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [filters, setFilters] = useState<InteractionFilters>(initialFilters || defaultFilters);
  const [sortConfig, setSortConfig] = useState<{ column: string; direction: 'asc' | 'desc' }>({
    column: 'date',
    direction: 'desc',
  });

  // Table columns configuration
  const columns = useMemo(() => [
    {
      id: 'date',
      header: 'Date',
      sortable: true,
      render: (row: CustomerInteraction) => dayjs(row.date).format('MMM D, YYYY'),
      width: '15%',
    },
    {
      id: 'type',
      header: 'Type',
      sortable: true,
      render: (row: CustomerInteraction) => (
        <span className="interaction-type" data-type={row.type}>
          {row.type.charAt(0).toUpperCase() + row.type.slice(1)}
        </span>
      ),
      width: '15%',
    },
    {
      id: 'owner',
      header: 'Owner',
      sortable: true,
      render: (row: CustomerInteraction) => row.owner.name,
      width: '20%',
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      render: (row: CustomerInteraction) => (
        <span className={`status-badge status-${row.status}`}>
          {row.status.replace('_', ' ').charAt(0).toUpperCase() + row.status.slice(1)}
        </span>
      ),
      width: '15%',
    },
    {
      id: 'description',
      header: 'Description',
      render: (row: CustomerInteraction) => row.description,
      width: '35%',
    },
  ], []);

  // Load interactions
  const loadInteractions = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await fetchInteractions(customerId, {
        page: currentPage,
        pageSize,
        sortBy: sortConfig.column,
        sortDir: sortConfig.direction,
        filters,
      });
      setInteractions(result.data);
      setTotalItems(result.total);
    } catch (error) {
      console.error('Failed to load interactions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [customerId, currentPage, pageSize, sortConfig, filters]);

  // Handle sort changes
  const handleSort = useCallback((column: string, direction: 'asc' | 'desc') => {
    setSortConfig({ column, direction });
  }, []);

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: Partial<InteractionFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setCurrentPage(1);
  }, []);

  // Handle page changes
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // Load data on mount and when dependencies change
  useEffect(() => {
    loadInteractions();
  }, [loadInteractions]);

  return (
    <ErrorBoundary>
      <Card
        className={className}
        variant="elevated"
        aria-label="Customer Interaction History"
      >
        <div className="interaction-history">
          <div className="interaction-history__filters">
            <FilterGroup>
              <DateRangePicker
                value={filters.dateRange}
                onChange={(range) => handleFilterChange({ dateRange: range })}
                maxDate={new Date()}
                aria-label="Filter by date range"
              />
              <FilterGroup.Select
                value={filters.types}
                options={[
                  { value: 'meeting', label: 'Meeting' },
                  { value: 'support', label: 'Support' },
                  { value: 'playbook', label: 'Playbook' },
                  { value: 'training', label: 'Training' },
                  { value: 'other', label: 'Other' },
                ]}
                onChange={(types) => handleFilterChange({ types })}
                placeholder="Filter by type"
                multiple
                aria-label="Filter by interaction type"
              />
              <FilterGroup.Select
                value={filters.status}
                options={[
                  { value: 'completed', label: 'Completed' },
                  { value: 'scheduled', label: 'Scheduled' },
                  { value: 'cancelled', label: 'Cancelled' },
                  { value: 'in_progress', label: 'In Progress' },
                ]}
                onChange={(status) => handleFilterChange({ status })}
                placeholder="Filter by status"
                multiple
                aria-label="Filter by status"
              />
            </FilterGroup>
          </div>

          <Table
            data={interactions}
            columns={columns}
            isLoading={isLoading}
            sortable
            pagination
            totalItems={totalItems}
            currentPage={currentPage}
            pageSize={pageSize}
            onSort={handleSort}
            onPageChange={handlePageChange}
            highContrast={theme.mode === 'high-contrast'}
            aria-label="Interaction history table"
          />
        </div>
      </Card>
    </ErrorBoundary>
  );
};

export default InteractionHistory;