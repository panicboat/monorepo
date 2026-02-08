/**
 * Shared Hooks
 *
 * Reusable hook utilities for API interactions.
 */

export {
  usePaginatedFetch,
  type PaginatedResult,
  type UsePaginatedFetchOptions,
  type UsePaginatedFetchReturn,
} from "./usePaginatedFetch";

export {
  useApiMutation,
  createMutationHook,
  type HttpMethod,
  type UseApiMutationOptions,
  type UseApiMutationReturn,
} from "./useApiMutation";

export { useHydrated, useOnHydrated } from "./useHydrated";
