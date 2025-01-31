// External imports
import { useCallback, useEffect } from 'react'; // v18.2.0
import { useDispatch, useSelector } from 'react-redux'; // v8.0.5

// Internal imports
import {
  fetchPlaybooks,
  createPlaybook,
  updatePlaybook,
  executePlaybook,
  setActivePlaybook,
} from '../../store/playbook/actions';
import {
  selectAllPlaybooks,
  selectActivePlaybook,
  selectPlaybookExecutions,
  selectPlaybookExecutionProgress,
} from '../../store/playbook/selectors';
import type { 
  Playbook,
  PlaybookCreateRequest,
  PlaybookUpdateRequest,
  PlaybookExecution 
} from '../../types/playbook';
import { performance } from '@blitzy/monitoring'; // v1.0.0
import { ErrorBoundary } from '@blitzy/error-handling'; // v1.0.0

/**
 * Custom hook for managing customer success playbook operations
 * Provides a simplified interface for playbook CRUD operations, execution tracking,
 * and state management with performance optimization and error handling
 */
export const usePlaybook = () => {
  const dispatch = useDispatch();

  // Memoized selectors for optimal performance
  const playbooks = useSelector(selectAllPlaybooks);
  const activePlaybook = useSelector(selectActivePlaybook);
  const executions = useSelector(selectPlaybookExecutions);
  const loading = useSelector(state => state.playbook.loading);
  const error = useSelector(state => state.playbook.error);
  const executionProgress = useSelector(state => state.playbook.executionProgress);

  /**
   * Fetch all playbooks with performance tracking and error handling
   */
  const handleFetchPlaybooks = useCallback(async () => {
    const perfTracker = performance.start('usePlaybook.fetchPlaybooks');
    try {
      await dispatch(fetchPlaybooks());
      perfTracker.end();
    } catch (err) {
      perfTracker.end({ error: true });
      ErrorBoundary.captureError(err);
    }
  }, [dispatch]);

  /**
   * Create new playbook with validation and optimistic updates
   */
  const handleCreatePlaybook = useCallback(async (data: PlaybookCreateRequest) => {
    const perfTracker = performance.start('usePlaybook.createPlaybook');
    try {
      await dispatch(createPlaybook(data));
      perfTracker.end();
    } catch (err) {
      perfTracker.end({ error: true });
      ErrorBoundary.captureError(err);
    }
  }, [dispatch]);

  /**
   * Update existing playbook with conflict resolution
   */
  const handleUpdatePlaybook = useCallback(async (id: string, data: PlaybookUpdateRequest) => {
    const perfTracker = performance.start('usePlaybook.updatePlaybook');
    try {
      await dispatch(updatePlaybook({ id, ...data }));
      perfTracker.end();
    } catch (err) {
      perfTracker.end({ error: true });
      ErrorBoundary.captureError(err);
    }
  }, [dispatch]);

  /**
   * Execute playbook for a customer with progress tracking
   */
  const handleExecutePlaybook = useCallback(async (playbookId: string, customerId: string) => {
    const perfTracker = performance.start('usePlaybook.executePlaybook');
    try {
      await dispatch(executePlaybook(playbookId, customerId));
      perfTracker.end();
    } catch (err) {
      perfTracker.end({ error: true });
      ErrorBoundary.captureError(err);
    }
  }, [dispatch]);

  /**
   * Set active playbook with cleanup
   */
  const handleSetActivePlaybook = useCallback((playbookId: string | null) => {
    dispatch(setActivePlaybook(playbookId));
  }, [dispatch]);

  /**
   * Clear any existing error state
   */
  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_PLAYBOOK_ERROR' });
  }, [dispatch]);

  /**
   * Fetch playbooks on mount with cleanup
   */
  useEffect(() => {
    handleFetchPlaybooks();
    return () => {
      handleSetActivePlaybook(null);
    };
  }, [handleFetchPlaybooks, handleSetActivePlaybook]);

  return {
    // State
    playbooks,
    activePlaybook,
    executions,
    loading,
    error,
    executionProgress,

    // Operations
    fetchPlaybooks: handleFetchPlaybooks,
    createPlaybook: handleCreatePlaybook,
    updatePlaybook: handleUpdatePlaybook,
    executePlaybook: handleExecutePlaybook,
    setActivePlaybook: handleSetActivePlaybook,
    clearError,
  };
};

/**
 * Type definitions for hook return value
 */
export type UsePlaybookReturn = {
  playbooks: Playbook[];
  activePlaybook: Playbook | null;
  executions: PlaybookExecution[];
  loading: boolean;
  error: Error | null;
  executionProgress: Record<string, number>;
  fetchPlaybooks: () => Promise<void>;
  createPlaybook: (data: PlaybookCreateRequest) => Promise<void>;
  updatePlaybook: (id: string, data: PlaybookUpdateRequest) => Promise<void>;
  executePlaybook: (playbookId: string, customerId: string) => Promise<void>;
  setActivePlaybook: (playbookId: string | null) => void;
  clearError: () => void;
};

export default usePlaybook;