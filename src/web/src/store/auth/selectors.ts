import { createSelector } from 'reselect'; // v4.1.0
import type { AuthState, UserRole } from '../../types/auth';

/**
 * Base selector to access the authentication state slice from root state
 * Provides type-safe access to auth state with proper immutability
 */
export const selectAuthState = (state: RootState): AuthState => state.auth;

/**
 * Memoized selector to check authentication status
 * Optimizes re-renders by only updating when isAuthenticated changes
 */
export const selectIsAuthenticated = createSelector(
  [selectAuthState],
  (authState): boolean => authState.isAuthenticated
);

/**
 * Memoized selector to access current user data with null safety
 * Provides type-safe access to user object with proper immutability
 */
export const selectCurrentUser = createSelector(
  [selectAuthState],
  (authState) => authState.user
);

/**
 * Memoized selector to access authentication token
 * Ensures type-safe access to token data with null safety
 */
export const selectAuthToken = createSelector(
  [selectAuthState],
  (authState) => authState.token
);

/**
 * Memoized selector to check if current user has admin role
 * Implements proper type guards and role-based access control
 */
export const selectIsAdmin = createSelector(
  [selectCurrentUser],
  (user): boolean => {
    if (!user) return false;
    return user.roles.includes(UserRole.ADMIN);
  }
);

/**
 * Memoized selector to check if current user has CS manager role
 * Implements proper type guards and role-based access control
 */
export const selectIsCSManager = createSelector(
  [selectCurrentUser],
  (user): boolean => {
    if (!user) return false;
    return user.roles.includes(UserRole.CS_MANAGER);
  }
);

/**
 * Memoized selector to check if authentication is in loading state
 * Optimizes re-renders during authentication flow
 */
export const selectAuthLoading = createSelector(
  [selectAuthState],
  (authState): boolean => authState.loading
);

/**
 * Memoized selector to access authentication error state
 * Provides type-safe access to error information
 */
export const selectAuthError = createSelector(
  [selectAuthState],
  (authState) => authState.error
);

/**
 * Type declaration for root state to ensure type safety
 * Defines expected shape of global state tree
 */
interface RootState {
  auth: AuthState;
}