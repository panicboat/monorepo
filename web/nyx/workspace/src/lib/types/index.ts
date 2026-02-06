/**
 * Shared Type Definitions
 *
 * Common types used across multiple modules.
 * Import from "@/lib/types" instead of duplicating.
 */

// =============================================================================
// Media Types
// =============================================================================

export type MediaType = "image" | "video";

/**
 * Base media type for posts, comments, and uploads
 */
export type Media = {
  id?: string;
  mediaType: MediaType;
  url: string;
  thumbnailUrl?: string;
};

/**
 * Extended media type with storage key (for uploads)
 */
export type MediaWithKey = Media & {
  key?: string;
};

// =============================================================================
// Author Types
// =============================================================================

export type UserType = "guest" | "cast";

/**
 * Base author type for posts
 */
export type Author = {
  id: string;
  name: string;
  imageUrl: string;
};

/**
 * Extended author type with user role
 */
export type AuthorWithType = Author & {
  userType: UserType;
};

// =============================================================================
// Pagination Types
// =============================================================================

/**
 * Generic paginated response type
 * Use for all cursor-based pagination responses
 */
export type PaginatedResponse<T> = {
  items: T[];
  nextCursor: string;
  hasMore: boolean;
};

/**
 * Generic paginated request params
 */
export type PaginationParams = {
  cursor?: string;
  limit?: number;
};

// =============================================================================
// API Response Types
// =============================================================================

/**
 * Standard API error response
 */
export type ApiError = {
  message: string;
  status?: number;
  code?: string;
};

/**
 * Standard mutation result
 */
export type MutationResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

// =============================================================================
// Role Types
// =============================================================================

export type Role = "guest" | "cast";
export type RoleNumber = 0 | 1; // 0 = cast, 1 = guest (based on existing API)

/**
 * Convert role string to number
 */
export function roleToNumber(role: Role): RoleNumber {
  return role === "guest" ? 1 : 0;
}

/**
 * Convert role number to string
 */
export function numberToRole(num: RoleNumber | number): Role {
  return num === 1 ? "guest" : "cast";
}
