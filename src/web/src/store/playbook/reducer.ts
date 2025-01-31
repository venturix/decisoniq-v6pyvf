// External imports - redux v4.2.1
import { Reducer } from 'redux';

// Internal imports
import { 
    PlaybookActionTypes,
    PlaybookAction,
    PlaybookState
} from './types';

/**
 * Initial state with normalized data structure for optimal performance
 */
const initialState: PlaybookState = {
    playbooks: {},
    activePlaybookId: null,
    executions: {},
    loading: false,
    error: null,
    lastUpdated: null,
    executionProgress: {}
};

/**
 * Redux reducer for managing playbook state with optimized performance
 * and enhanced execution tracking
 */
export const playbookReducer: Reducer<PlaybookState, PlaybookAction> = (
    state = initialState,
    action
): PlaybookState => {
    switch (action.type) {
        case PlaybookActionTypes.FETCH_PLAYBOOKS_REQUEST:
            return {
                ...state,
                loading: true,
                error: null
            };

        case PlaybookActionTypes.FETCH_PLAYBOOKS_SUCCESS:
            return {
                ...state,
                playbooks: action.payload,
                loading: false,
                error: null,
                lastUpdated: new Date()
            };

        case PlaybookActionTypes.FETCH_PLAYBOOKS_FAILURE:
            return {
                ...state,
                loading: false,
                error: action.error,
                lastUpdated: new Date()
            };

        case PlaybookActionTypes.CREATE_PLAYBOOK_REQUEST:
            return {
                ...state,
                loading: true,
                error: null
            };

        case PlaybookActionTypes.CREATE_PLAYBOOK_SUCCESS:
            return {
                ...state,
                playbooks: {
                    ...state.playbooks,
                    [action.payload.id]: action.payload
                },
                loading: false,
                error: null,
                lastUpdated: new Date()
            };

        case PlaybookActionTypes.CREATE_PLAYBOOK_FAILURE:
            return {
                ...state,
                loading: false,
                error: action.error
            };

        case PlaybookActionTypes.UPDATE_PLAYBOOK_REQUEST:
            return {
                ...state,
                loading: true,
                error: null
            };

        case PlaybookActionTypes.UPDATE_PLAYBOOK_SUCCESS:
            return {
                ...state,
                playbooks: {
                    ...state.playbooks,
                    [action.payload.id]: {
                        ...state.playbooks[action.payload.id],
                        ...action.payload
                    }
                },
                loading: false,
                error: null,
                lastUpdated: new Date()
            };

        case PlaybookActionTypes.UPDATE_PLAYBOOK_FAILURE:
            return {
                ...state,
                loading: false,
                error: action.error
            };

        case PlaybookActionTypes.DELETE_PLAYBOOK_REQUEST:
            return {
                ...state,
                loading: true,
                error: null
            };

        case PlaybookActionTypes.DELETE_PLAYBOOK_SUCCESS: {
            const { [action.payload]: deletedPlaybook, ...remainingPlaybooks } = state.playbooks;
            return {
                ...state,
                playbooks: remainingPlaybooks,
                activePlaybookId: state.activePlaybookId === action.payload ? null : state.activePlaybookId,
                loading: false,
                error: null,
                lastUpdated: new Date()
            };
        }

        case PlaybookActionTypes.DELETE_PLAYBOOK_FAILURE:
            return {
                ...state,
                loading: false,
                error: action.error
            };

        case PlaybookActionTypes.EXECUTE_PLAYBOOK_REQUEST:
            return {
                ...state,
                loading: true,
                error: null,
                executionProgress: {
                    ...state.executionProgress,
                    [action.payload.playbookId]: 0
                }
            };

        case PlaybookActionTypes.EXECUTE_PLAYBOOK_SUCCESS:
            return {
                ...state,
                executions: {
                    ...state.executions,
                    [action.payload.id]: action.payload
                },
                loading: false,
                error: null,
                executionProgress: {
                    ...state.executionProgress,
                    [action.payload.playbookId]: 100
                }
            };

        case PlaybookActionTypes.EXECUTE_PLAYBOOK_FAILURE:
            return {
                ...state,
                loading: false,
                error: action.error,
                executionProgress: {
                    ...state.executionProgress,
                    [action.payload.playbookId]: 0
                }
            };

        case PlaybookActionTypes.SET_ACTIVE_PLAYBOOK:
            return {
                ...state,
                activePlaybookId: action.payload
            };

        case PlaybookActionTypes.UPDATE_EXECUTION_PROGRESS:
            return {
                ...state,
                executionProgress: {
                    ...state.executionProgress,
                    [action.payload.executionId]: action.payload.progress
                }
            };

        default:
            return state;
    }
};