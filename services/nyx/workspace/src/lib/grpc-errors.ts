import { ConnectError } from "@connectrpc/connect";

export const GrpcCode = {
  INVALID_ARGUMENT: 3,
  NOT_FOUND: 5,
  ALREADY_EXISTS: 6,
  PERMISSION_DENIED: 7,
  UNAUTHENTICATED: 16,
} as const;

const GRPC_TO_HTTP: Record<number, number> = {
  [GrpcCode.INVALID_ARGUMENT]: 400,
  [GrpcCode.NOT_FOUND]: 404,
  [GrpcCode.ALREADY_EXISTS]: 409,
  [GrpcCode.PERMISSION_DENIED]: 403,
  [GrpcCode.UNAUTHENTICATED]: 401,
};

export function grpcCodeToHttpStatus(code: number): number {
  return GRPC_TO_HTTP[code] ?? 500;
}

export function isConnectError(error: unknown): error is ConnectError {
  return error instanceof ConnectError;
}
