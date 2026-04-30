/**
 * Auth Module
 *
 * Centralized authentication token management.
 *
 * Usage:
 * - For hooks/API calls: use `getAuthToken()` (recommended)
 * - For React components: use `useAuthStore` from stores/authStore
 * - For low-level localStorage: use `getAccessToken()` from tokens.ts
 */

// Recommended: Get token from Zustand store (synced with localStorage)
export { getAuthToken } from "../swr";

// Authenticated fetch utility
export { authFetch, type AuthFetchOptions } from "./fetch";

// Low-level token operations (direct localStorage access)
export {
  getAccessToken,
  getRole,
  getTokens,
  setTokens,
  clearTokens,
  isAuthenticated,
  type Role,
  type TokenData,
} from "./tokens";
