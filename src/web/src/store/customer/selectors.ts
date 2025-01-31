/**
 * Redux selector functions for accessing and computing derived customer state data
 * @version 1.0.0
 * @package @customer-success-ai/web
 */

import { createSelector } from 'reselect'; // ^4.1.0
import type { CustomerState } from './types';
import type { Customer } from '../../types/customer';
import type { CustomerHealthScore, CustomerInteraction } from './types';

/**
 * Base selector to access the customer state slice from root state
 * Provides type-safe access to the customer domain state
 */
export const selectCustomerState = (state: RootState): CustomerState => state.customer;

/**
 * Memoized selector to get all customers array
 * Uses shallow equality comparison for performance optimization
 */
export const selectAllCustomers = createSelector(
  selectCustomerState,
  (state: CustomerState): Customer[] => state.customers
);

/**
 * Memoized selector to get currently selected customer
 * Provides null safety with proper TypeScript types
 */
export const selectSelectedCustomer = createSelector(
  selectCustomerState,
  (state: CustomerState): Customer | null => state.selectedCustomer
);

/**
 * Memoized selector to get customer health scores map
 * Provides type-safe access to health score records
 */
export const selectCustomerHealthScores = createSelector(
  selectCustomerState,
  (state: CustomerState): Record<string, CustomerHealthScore> => state.healthScores
);

/**
 * Memoized selector to get customer interactions array
 * Provides type-safe access to interaction history
 */
export const selectCustomerInteractions = createSelector(
  selectCustomerState,
  (state: CustomerState): CustomerInteraction[] => state.interactions
);

/**
 * Memoized selector factory to get customer by ID
 * Returns undefined if customer not found
 * @param customerId - Unique identifier of the customer to find
 */
export const selectCustomerById = createSelector(
  [selectAllCustomers, (_: RootState, customerId: string) => customerId],
  (customers: Customer[], customerId: string): Customer | undefined =>
    customers.find(customer => customer.id === customerId)
);

/**
 * Memoized selector factory to get health score by customer ID
 * Returns undefined if health score not found
 * @param customerId - Unique identifier of the customer to get health score for
 */
export const selectCustomerHealthScore = createSelector(
  [selectCustomerHealthScores, (_: RootState, customerId: string) => customerId],
  (healthScores: Record<string, CustomerHealthScore>, customerId: string): CustomerHealthScore | undefined =>
    healthScores[customerId]
);

/**
 * Memoized selector to get loading state
 * Provides type-safe access to loading indicator
 */
export const selectCustomerLoading = createSelector(
  selectCustomerState,
  (state: CustomerState): boolean => state.loading
);

/**
 * Memoized selector to get error state
 * Provides type-safe access to error messages
 */
export const selectCustomerError = createSelector(
  selectCustomerState,
  (state: CustomerState): string | null => state.error
);

/**
 * Memoized selector to get customer interactions by customer ID
 * Returns empty array if no interactions found
 * @param customerId - Unique identifier of the customer to get interactions for
 */
export const selectCustomerInteractionsByCustomerId = createSelector(
  [selectCustomerInteractions, (_: RootState, customerId: string) => customerId],
  (interactions: CustomerInteraction[], customerId: string): CustomerInteraction[] =>
    interactions.filter(interaction => interaction.customerId === customerId)
);

/**
 * Type declaration for root state to ensure type safety
 * This should match your root reducer structure
 */
interface RootState {
  customer: CustomerState;
  // Add other state slices as needed
}