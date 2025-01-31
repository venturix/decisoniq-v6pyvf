import React, { memo, useCallback, useEffect } from 'react'; // ^18.0.0
import { useDispatch, useSelector } from 'react-redux'; // ^8.1.0
import { BlitzyUI } from '@blitzy/premium-ui'; // ^2.0.0
import { Table } from '../common/Table';
import { selectAllPlaybooks } from '../../store/playbook/selectors';
import { fetchPlaybooks, setActivePlaybook } from '../../store/playbook/actions';
import { ErrorBoundary } from '../common/ErrorBoundary';
import type { Playbook } from '../../types/playbook';
import type { TableColumn } from '../common/Table';

// Constants for component configuration
const PAGE_SIZE = 25;

// Column definitions with accessibility support
const COLUMNS: TableColumn<Playbook>[] = [
  {
    id: 'name',
    header: 'Name',
    sortable: true,
    ariaLabel: 'Playbook name',
    render: (playbook: Playbook) => (
      <div className="playbook-name">
        <BlitzyUI.Text variant="subtitle1">{playbook.name}</BlitzyUI.Text>
        <BlitzyUI.Text variant="caption" color="textSecondary">
          {playbook.description}
        </BlitzyUI.Text>
      </div>
    )
  },
  {
    id: 'status',
    header: 'Status',
    sortable: true,
    ariaLabel: 'Playbook status',
    render: (playbook: Playbook) => (
      <BlitzyUI.Badge
        variant={playbook.status === 'ACTIVE' ? 'success' : 'default'}
        label={playbook.status}
        aria-label={`Status: ${playbook.status}`}
      />
    )
  },
  {
    id: 'lastExecuted',
    header: 'Last Executed',
    sortable: true,
    ariaLabel: 'Last execution date',
    render: (playbook: Playbook) => (
      <BlitzyUI.Text variant="body2">
        {playbook.executions?.length > 0
          ? new Date(playbook.executions[0].startedAt).toLocaleDateString()
          : 'Never'}
      </BlitzyUI.Text>
    )
  },
  {
    id: 'successRate',
    header: 'Success Rate',
    sortable: true,
    ariaLabel: 'Success rate percentage',
    render: (playbook: Playbook) => {
      const successRate = calculateSuccessRate(playbook);
      return (
        <BlitzyUI.Progress
          value={successRate}
          variant={getSuccessRateVariant(successRate)}
          label={`${successRate}%`}
          aria-label={`Success rate: ${successRate}%`}
        />
      );
    }
  }
];

// Props interface with strict typing
interface PlaybookListProps {
  isLoading?: boolean;
  className?: string;
  virtualized?: boolean;
  onError?: (error: Error) => void;
}

// Helper function to calculate success rate
const calculateSuccessRate = (playbook: Playbook): number => {
  if (!playbook.executions?.length) return 0;
  const successful = playbook.executions.filter(e => e.status === 'completed').length;
  return Math.round((successful / playbook.executions.length) * 100);
};

// Helper function to determine success rate variant
const getSuccessRateVariant = (rate: number): 'success' | 'warning' | 'error' => {
  if (rate >= 80) return 'success';
  if (rate >= 50) return 'warning';
  return 'error';
};

/**
 * PlaybookList Component
 * Displays a virtualized, sortable list of customer success playbooks
 * with real-time status updates and accessibility support
 */
export const PlaybookList = memo<PlaybookListProps>(({
  isLoading = false,
  className,
  virtualized = true,
  onError
}) => {
  const dispatch = useDispatch();
  const playbooks = useSelector(selectAllPlaybooks);

  // Fetch playbooks on mount with error handling
  useEffect(() => {
    const fetchData = async () => {
      try {
        await dispatch(fetchPlaybooks());
      } catch (error) {
        onError?.(error as Error);
      }
    };
    fetchData();
  }, [dispatch, onError]);

  // Handle playbook selection with optimistic updates
  const handlePlaybookSelect = useCallback(async (playbookId: string) => {
    try {
      dispatch(setActivePlaybook(playbookId));
      // Additional telemetry or side effects can be added here
    } catch (error) {
      onError?.(error as Error);
      dispatch(setActivePlaybook(null)); // Rollback on error
    }
  }, [dispatch, onError]);

  // Handle sorting with performance optimization
  const handleSort = useCallback((columnId: string, direction: 'asc' | 'desc') => {
    const sortedPlaybooks = [...playbooks].sort((a, b) => {
      const aValue = a[columnId as keyof Playbook];
      const bValue = b[columnId as keyof Playbook];
      return direction === 'asc'
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });
    return sortedPlaybooks;
  }, [playbooks]);

  return (
    <ErrorBoundary
      onError={onError}
      fallback={
        <BlitzyUI.Alert
          severity="error"
          title="Error loading playbooks"
          action={
            <BlitzyUI.Button
              variant="secondary"
              onClick={() => dispatch(fetchPlaybooks())}
            >
              Retry
            </BlitzyUI.Button>
          }
        />
      }
    >
      <div
        className={className}
        role="region"
        aria-label="Playbook list"
      >
        <Table<Playbook>
          data={playbooks}
          columns={COLUMNS}
          isLoading={isLoading}
          virtualized={virtualized}
          sortable
          pagination
          pageSize={PAGE_SIZE}
          onRowClick={row => handlePlaybookSelect(row.id)}
          onSort={handleSort}
          ariaLabel="Playbooks table"
          highContrast={false}
        />
      </div>
    </ErrorBoundary>
  );
});

PlaybookList.displayName = 'PlaybookList';

export default PlaybookList;