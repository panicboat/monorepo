/**
 * Standardized API response types
 *
 * All API responses should follow this envelope format for consistency.
 */

/**
 * Base API response envelope
 */
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

/**
 * Standardized error format
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Response metadata (pagination, etc.)
 */
export interface ApiMeta {
  cursor?: string;
  hasMore?: boolean;
  total?: number;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: ApiMeta & {
    cursor?: string;
    hasMore: boolean;
  };
}

/**
 * Common error codes
 */
export const API_ERROR_CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  NETWORK_ERROR: "NETWORK_ERROR",
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

/**
 * gRPC to HTTP status code mapping
 */
export const GRPC_TO_HTTP_STATUS: Record<number, number> = {
  0: 200,  // OK
  1: 499,  // CANCELLED
  2: 500,  // UNKNOWN
  3: 400,  // INVALID_ARGUMENT
  4: 504,  // DEADLINE_EXCEEDED
  5: 404,  // NOT_FOUND
  6: 409,  // ALREADY_EXISTS
  7: 403,  // PERMISSION_DENIED
  8: 429,  // RESOURCE_EXHAUSTED
  9: 400,  // FAILED_PRECONDITION
  10: 409, // ABORTED
  11: 400, // OUT_OF_RANGE
  12: 501, // UNIMPLEMENTED
  13: 500, // INTERNAL
  14: 503, // UNAVAILABLE
  15: 500, // DATA_LOSS
  16: 401, // UNAUTHENTICATED
};

/**
 * gRPC code to error code mapping
 */
export const GRPC_TO_ERROR_CODE: Record<number, ApiErrorCode> = {
  5: API_ERROR_CODES.NOT_FOUND,
  7: API_ERROR_CODES.FORBIDDEN,
  16: API_ERROR_CODES.UNAUTHORIZED,
};
