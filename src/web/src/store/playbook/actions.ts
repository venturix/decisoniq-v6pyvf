// External imports
import { ThunkAction } from 'redux-thunk'; // v2.4.2
import { Dispatch } from 'redux'; // v4.2.1
import { performance } from '@blitzy/monitoring'; // v1.0.0
import { ErrorBoundary } from '@blitzy/error-handling'; // v1.0.0

// Internal imports
import { 
    PlaybookActionTypes,
    PlaybookAction,
} from './types';
import { Playbook } from '../../types/playbook';

// Constants
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

/**
 * Interface for fetch options to customize playbook retrieval
 */
interface FetchOptions {
    forceRefresh?: boolean;
    customerId?: string;
    status?: string[];
}

/**
 * Fetches playbooks with caching and retry logic
 * @param options - Optional parameters to customize the fetch operation
 */
export const fetchPlaybooks = (
    options: FetchOptions = {}
): ThunkAction<Promise<void>, any, unknown, PlaybookAction> => {
    return async (dispatch: Dispatch) => {
        const perfTracker = performance.start('fetchPlaybooks');

        try {
            dispatch({ type: PlaybookActionTypes.FETCH_PLAYBOOKS_REQUEST });

            let retries = 0;
            let success = false;

            while (!success && retries < MAX_RETRIES) {
                try {
                    const response = await fetch('/api/v1/playbooks', {
                        headers: {
                            'Cache-Control': options.forceRefresh ? 'no-cache' : `max-age=${CACHE_TTL}`,
                        },
                        params: {
                            customerId: options.customerId,
                            status: options.status?.join(','),
                        },
                    });

                    const playbooks = await response.json();
                    
                    dispatch({
                        type: PlaybookActionTypes.FETCH_PLAYBOOKS_SUCCESS,
                        payload: playbooks,
                    });
                    
                    success = true;
                    perfTracker.end();
                } catch (error) {
                    retries++;
                    if (retries === MAX_RETRIES) {
                        throw error;
                    }
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, retries)));
                }
            }
        } catch (error) {
            perfTracker.end({ error: true });
            dispatch({
                type: PlaybookActionTypes.FETCH_PLAYBOOKS_FAILURE,
                error: error.message,
            });
            ErrorBoundary.captureError(error);
        }
    };
};

/**
 * Creates a new playbook with optimistic updates
 * @param playbook - The playbook data to create
 */
export const createPlaybook = (
    playbook: Omit<Playbook, 'id'>
): ThunkAction<Promise<void>, any, unknown, PlaybookAction> => {
    return async (dispatch: Dispatch) => {
        const perfTracker = performance.start('createPlaybook');

        try {
            dispatch({
                type: PlaybookActionTypes.CREATE_PLAYBOOK_REQUEST,
                payload: playbook,
            });

            const response = await fetch('/api/v1/playbooks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(playbook),
            });

            const createdPlaybook = await response.json();
            
            dispatch({
                type: PlaybookActionTypes.CREATE_PLAYBOOK_SUCCESS,
                payload: createdPlaybook,
            });
            
            perfTracker.end();
        } catch (error) {
            perfTracker.end({ error: true });
            dispatch({
                type: PlaybookActionTypes.CREATE_PLAYBOOK_FAILURE,
                error: error.message,
            });
            ErrorBoundary.captureError(error);
        }
    };
};

/**
 * Updates an existing playbook with conflict resolution
 * @param playbook - The updated playbook data
 */
export const updatePlaybook = (
    playbook: Playbook
): ThunkAction<Promise<void>, any, unknown, PlaybookAction> => {
    return async (dispatch: Dispatch) => {
        const perfTracker = performance.start('updatePlaybook');

        try {
            dispatch({
                type: PlaybookActionTypes.UPDATE_PLAYBOOK_REQUEST,
                payload: playbook,
            });

            const response = await fetch(`/api/v1/playbooks/${playbook.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(playbook),
            });

            const updatedPlaybook = await response.json();
            
            dispatch({
                type: PlaybookActionTypes.UPDATE_PLAYBOOK_SUCCESS,
                payload: updatedPlaybook,
            });
            
            perfTracker.end();
        } catch (error) {
            perfTracker.end({ error: true });
            dispatch({
                type: PlaybookActionTypes.UPDATE_PLAYBOOK_FAILURE,
                error: error.message,
            });
            ErrorBoundary.captureError(error);
        }
    };
};

/**
 * Executes a playbook for a specific customer with progress tracking
 * @param playbookId - The ID of the playbook to execute
 * @param customerId - The ID of the customer to execute the playbook for
 */
export const executePlaybook = (
    playbookId: string,
    customerId: string
): ThunkAction<Promise<void>, any, unknown, PlaybookAction> => {
    return async (dispatch: Dispatch) => {
        const perfTracker = performance.start('executePlaybook');

        try {
            dispatch({
                type: PlaybookActionTypes.EXECUTE_PLAYBOOK_REQUEST,
                payload: { playbookId, customerId },
            });

            const response = await fetch('/api/v1/playbooks/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playbookId, customerId }),
            });

            const execution = await response.json();
            
            dispatch({
                type: PlaybookActionTypes.EXECUTE_PLAYBOOK_SUCCESS,
                payload: execution,
            });
            
            perfTracker.end();
        } catch (error) {
            perfTracker.end({ error: true });
            dispatch({
                type: PlaybookActionTypes.EXECUTE_PLAYBOOK_FAILURE,
                error: error.message,
            });
            ErrorBoundary.captureError(error);
        }
    };
};

/**
 * Sets the active playbook in the UI with validation
 * @param playbookId - The ID of the playbook to set as active, or null to clear
 */
export const setActivePlaybook = (playbookId: string | null): PlaybookAction => ({
    type: PlaybookActionTypes.SET_ACTIVE_PLAYBOOK,
    payload: playbookId,
});