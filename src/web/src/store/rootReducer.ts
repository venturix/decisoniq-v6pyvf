/**
 * Root Redux reducer combining all feature-specific reducers
 * Implements high-performance state management with strict type safety
 * @version 1.0.0
 * @package @customer-success-ai/web
 */

// External imports
import { combineReducers } from 'redux'; // v4.2.1

// Feature-specific reducer imports
import authReducer from './auth/reducer';
import customerReducer from './customer/reducer';
import playbookReducer from './playbook/reducer';
import riskReducer from './risk/reducer';
import metricsReducer from './metrics/reducer';

/**
 * Combined root state type with strict readonly modifiers
 * Provides type safety for the entire application state tree
 */
export type RootState = Readonly<{
  auth: ReturnType<typeof authReducer>;
  customer: ReturnType<typeof customerReducer>;
  playbook: ReturnType<typeof playbookReducer>;
  risk: ReturnType<typeof riskReducer>;
  metrics: ReturnType<typeof metricsReducer>;
}>;

/**
 * Root reducer combining all feature reducers with performance optimization
 * Implements strict type checking and immutable state updates
 */
const rootReducer = combineReducers<RootState>({
  auth: authReducer,
  customer: customerReducer,
  playbook: playbookReducer,
  risk: riskReducer,
  metrics: metricsReducer
});

/**
 * Type-safe action type for the root reducer combining all feature actions
 */
export type RootAction = 
  | Parameters<typeof authReducer>[1]
  | Parameters<typeof customerReducer>[1]
  | Parameters<typeof playbookReducer>[1]
  | Parameters<typeof riskReducer>[1]
  | Parameters<typeof metricsReducer>[1];

export default rootReducer;