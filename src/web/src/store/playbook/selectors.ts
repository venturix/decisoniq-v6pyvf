// External imports
import { createSelector } from 'reselect'; // v4.1.8

// Internal imports
import type { RootState } from '../rootReducer';
import type { PlaybookState } from './types';

/**
 * Base selector for accessing playbook state slice
 * Provides type-safe access to playbook state from root state
 */
export const selectPlaybookState = (state: RootState): PlaybookState => state.playbook;

/**
 * Memoized selector for retrieving all playbooks as a sorted array
 * Optimized for O(1) lookup with normalized data structure
 */
export const selectAllPlaybooks = createSelector(
  [selectPlaybookState],
  (playbookState): Playbook[] => {
    // Convert normalized playbook object to array and sort by creation date
    return Object.values(playbookState.playbooks)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
);

/**
 * Memoized selector for retrieving currently active playbook
 * Implements null safety and efficient lookup
 */
export const selectActivePlaybook = createSelector(
  [selectPlaybookState],
  (playbookState): Playbook | null => {
    const { activePlaybookId, playbooks } = playbookState;
    if (!activePlaybookId) return null;
    return playbooks[activePlaybookId] || null;
  }
);

/**
 * Memoized selector for retrieving playbook executions as a sorted array
 * Optimized for performance with execution status tracking
 */
export const selectPlaybookExecutions = createSelector(
  [selectPlaybookState],
  (playbookState): PlaybookExecution[] => {
    // Convert normalized executions object to array and sort by start time
    return Object.values(playbookState.executions)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }
);

/**
 * Memoized selector for retrieving execution progress for a specific playbook
 * Provides efficient access to execution status with O(1) lookup
 */
export const selectPlaybookExecutionProgress = createSelector(
  [selectPlaybookState, (_state: RootState, executionId: string) => executionId],
  (playbookState, executionId): number => {
    return playbookState.executionProgress[executionId] || 0;
  }
);

/**
 * Memoized selector for retrieving active playbooks filtered by status
 * Optimized for filtered lookups with minimal recomputation
 */
export const selectActivePlaybooks = createSelector(
  [selectAllPlaybooks],
  (playbooks): Playbook[] => {
    return playbooks.filter(playbook => playbook.status === 'ACTIVE');
  }
);

/**
 * Memoized selector for retrieving recent playbook executions
 * Limited to last 100 executions for performance optimization
 */
export const selectRecentExecutions = createSelector(
  [selectPlaybookExecutions],
  (executions): PlaybookExecution[] => {
    return executions.slice(0, 100);
  }
);

/**
 * Memoized selector for retrieving execution success rate
 * Calculates success metrics with minimal recomputation
 */
export const selectExecutionSuccessRate = createSelector(
  [selectPlaybookExecutions],
  (executions): number => {
    if (executions.length === 0) return 0;
    
    const successfulExecutions = executions.filter(
      execution => execution.status === 'completed'
    );
    
    return (successfulExecutions.length / executions.length) * 100;
  }
);

/**
 * Memoized selector for retrieving playbook by ID with type safety
 * Implements efficient lookup with null safety
 */
export const selectPlaybookById = createSelector(
  [selectPlaybookState, (_state: RootState, playbookId: string) => playbookId],
  (playbookState, playbookId): Playbook | null => {
    return playbookState.playbooks[playbookId] || null;
  }
);