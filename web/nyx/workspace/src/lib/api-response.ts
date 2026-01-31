import { NextResponse } from "next/server";
import { ConnectError } from "@connectrpc/connect";
import {
  ApiResponse,
  ApiError,
  ApiMeta,
  API_ERROR_CODES,
  GRPC_TO_HTTP_STATUS,
  GRPC_TO_ERROR_CODE,
} from "@/types/api";

/**
 * Create a successful API response
 */
export function apiSuccess<T>(data: T, meta?: ApiMeta): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ data, meta });
}

/**
 * Create an error API response
 */
export function apiError(
  code: string,
  message: string,
  status: number = 500,
  details?: Record<string, unknown>
): NextResponse<ApiResponse<never>> {
  return NextResponse.json(
    {
      error: { code, message, details },
    },
    { status }
  );
}

/**
 * Create an unauthorized error response
 */
export function apiUnauthorized(message: string = "Unauthorized"): NextResponse<ApiResponse<never>> {
  return apiError(API_ERROR_CODES.UNAUTHORIZED, message, 401);
}

/**
 * Create a not found error response
 */
export function apiNotFound(message: string = "Not Found"): NextResponse<ApiResponse<never>> {
  return apiError(API_ERROR_CODES.NOT_FOUND, message, 404);
}

/**
 * Create a validation error response
 */
export function apiValidationError(
  message: string,
  details?: Record<string, unknown>
): NextResponse<ApiResponse<never>> {
  return apiError(API_ERROR_CODES.VALIDATION_ERROR, message, 400, details);
}

/**
 * Handle gRPC/Connect errors and convert to API response
 */
export function handleGrpcError(error: unknown): NextResponse<ApiResponse<never>> {
  if (error instanceof ConnectError) {
    const httpStatus = GRPC_TO_HTTP_STATUS[error.code] || 500;
    const errorCode = GRPC_TO_ERROR_CODE[error.code] || API_ERROR_CODES.INTERNAL_ERROR;

    return apiError(errorCode, error.message, httpStatus);
  }

  // Generic error
  const message = error instanceof Error ? error.message : "Internal server error";
  return apiError(API_ERROR_CODES.INTERNAL_ERROR, message, 500);
}

/**
 * Wrapper for API route handlers with standardized error handling
 */
export function withApiHandler<T>(
  handler: () => Promise<T>
): Promise<NextResponse<ApiResponse<T>>> {
  return handler()
    .then((data) => apiSuccess(data))
    .catch((error) => handleGrpcError(error));
}

/**
 * Check authorization header and return error if missing
 */
export function requireAuth(
  authHeader: string | null
): NextResponse<ApiResponse<never>> | null {
  if (!authHeader) {
    return apiUnauthorized();
  }
  return null;
}
