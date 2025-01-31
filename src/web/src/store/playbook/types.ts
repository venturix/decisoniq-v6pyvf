// External imports
import { Action } from 'redux'; // v4.2.1
import { Playbook, PlaybookExecution } from '../../types/playbook';

/**
 * Enum of all possible action types for playbook state management
 * Follows Redux best practices for action type naming
 */
export enum PlaybookActionTypes {
    // Fetch playbooks
    FETCH_PLAYBOOKS_REQUEST = '@playbook/FETCH_PLAYBOOKS_REQUEST',
    FETCH_PLAYBOOKS_SUCCESS = '@playbook/FETCH_PLAYBOOKS_SUCCESS',
    FETCH_PLAYBOOKS_FAILURE = '@playbook/FETCH_PLAYBOOKS_FAILURE',

    // Create playbook
    CREATE_PLAYBOOK_REQUEST = '@playbook/CREATE_PLAYBOOK_REQUEST',
    CREATE_PLAYBOOK_SUCCESS = '@playbook/CREATE_PLAYBOOK_SUCCESS',
    CREATE_PLAYBOOK_FAILURE = '@playbook/CREATE_PLAYBOOK_FAILURE',

    // Update playbook
    UPDATE_PLAYBOOK_REQUEST = '@playbook/UPDATE_PLAYBOOK_REQUEST',
    UPDATE_PLAYBOOK_SUCCESS = '@playbook/UPDATE_PLAYBOOK_SUCCESS',
    UPDATE_PLAYBOOK_FAILURE = '@playbook/UPDATE_PLAYBOOK_FAILURE',

    // Delete playbook
    DELETE_PLAYBOOK_REQUEST = '@playbook/DELETE_PLAYBOOK_REQUEST',
    DELETE_PLAYBOOK_SUCCESS = '@playbook/DELETE_PLAYBOOK_SUCCESS',
    DELETE_PLAYBOOK_FAILURE = '@playbook/DELETE_PLAYBOOK_FAILURE',

    // Execute playbook
    EXECUTE_PLAYBOOK_REQUEST = '@playbook/EXECUTE_PLAYBOOK_REQUEST',
    EXECUTE_PLAYBOOK_SUCCESS = '@playbook/EXECUTE_PLAYBOOK_SUCCESS',
    EXECUTE_PLAYBOOK_FAILURE = '@playbook/EXECUTE_PLAYBOOK_FAILURE',

    // UI state management
    SET_ACTIVE_PLAYBOOK = '@playbook/SET_ACTIVE_PLAYBOOK',
    UPDATE_EXECUTION_PROGRESS = '@playbook/UPDATE_EXECUTION_PROGRESS'
}

/**
 * Interface defining the shape of the playbook state in Redux store
 * Uses normalized data structure for optimal performance
 */
export interface PlaybookState {
    readonly playbooks: Record<string, Playbook>;
    readonly activePlaybookId: string | null;
    readonly executions: Record<string, PlaybookExecution>;
    readonly loading: boolean;
    readonly error: string | null;
    readonly lastUpdated: Date | null;
}

// Action Interfaces
export interface FetchPlaybooksRequestAction extends Action {
    readonly type: PlaybookActionTypes.FETCH_PLAYBOOKS_REQUEST;
}

export interface FetchPlaybooksSuccessAction extends Action {
    readonly type: PlaybookActionTypes.FETCH_PLAYBOOKS_SUCCESS;
    readonly payload: Record<string, Playbook>;
}

export interface FetchPlaybooksFailureAction extends Action {
    readonly type: PlaybookActionTypes.FETCH_PLAYBOOKS_FAILURE;
    readonly error: string;
}

export interface CreatePlaybookRequestAction extends Action {
    readonly type: PlaybookActionTypes.CREATE_PLAYBOOK_REQUEST;
    readonly payload: Omit<Playbook, 'id'>;
}

export interface CreatePlaybookSuccessAction extends Action {
    readonly type: PlaybookActionTypes.CREATE_PLAYBOOK_SUCCESS;
    readonly payload: Playbook;
}

export interface CreatePlaybookFailureAction extends Action {
    readonly type: PlaybookActionTypes.CREATE_PLAYBOOK_FAILURE;
    readonly error: string;
}

export interface UpdatePlaybookRequestAction extends Action {
    readonly type: PlaybookActionTypes.UPDATE_PLAYBOOK_REQUEST;
    readonly payload: Playbook;
}

export interface UpdatePlaybookSuccessAction extends Action {
    readonly type: PlaybookActionTypes.UPDATE_PLAYBOOK_SUCCESS;
    readonly payload: Playbook;
}

export interface UpdatePlaybookFailureAction extends Action {
    readonly type: PlaybookActionTypes.UPDATE_PLAYBOOK_FAILURE;
    readonly error: string;
}

export interface DeletePlaybookRequestAction extends Action {
    readonly type: PlaybookActionTypes.DELETE_PLAYBOOK_REQUEST;
    readonly payload: string;
}

export interface DeletePlaybookSuccessAction extends Action {
    readonly type: PlaybookActionTypes.DELETE_PLAYBOOK_SUCCESS;
    readonly payload: string;
}

export interface DeletePlaybookFailureAction extends Action {
    readonly type: PlaybookActionTypes.DELETE_PLAYBOOK_FAILURE;
    readonly error: string;
}

export interface ExecutePlaybookRequestAction extends Action {
    readonly type: PlaybookActionTypes.EXECUTE_PLAYBOOK_REQUEST;
    readonly payload: {
        playbookId: string;
        customerId: string;
    };
}

export interface ExecutePlaybookSuccessAction extends Action {
    readonly type: PlaybookActionTypes.EXECUTE_PLAYBOOK_SUCCESS;
    readonly payload: PlaybookExecution;
}

export interface ExecutePlaybookFailureAction extends Action {
    readonly type: PlaybookActionTypes.EXECUTE_PLAYBOOK_FAILURE;
    readonly error: string;
}

export interface SetActivePlaybookAction extends Action {
    readonly type: PlaybookActionTypes.SET_ACTIVE_PLAYBOOK;
    readonly payload: string | null;
}

export interface UpdateExecutionProgressAction extends Action {
    readonly type: PlaybookActionTypes.UPDATE_EXECUTION_PROGRESS;
    readonly payload: {
        executionId: string;
        progress: number;
    };
}

/**
 * Union type of all possible playbook actions
 * Used for type checking in reducers and middleware
 */
export type PlaybookAction =
    | FetchPlaybooksRequestAction
    | FetchPlaybooksSuccessAction
    | FetchPlaybooksFailureAction
    | CreatePlaybookRequestAction
    | CreatePlaybookSuccessAction
    | CreatePlaybookFailureAction
    | UpdatePlaybookRequestAction
    | UpdatePlaybookSuccessAction
    | UpdatePlaybookFailureAction
    | DeletePlaybookRequestAction
    | DeletePlaybookSuccessAction
    | DeletePlaybookFailureAction
    | ExecutePlaybookRequestAction
    | ExecutePlaybookSuccessAction
    | ExecutePlaybookFailureAction
    | SetActivePlaybookAction
    | UpdateExecutionProgressAction;