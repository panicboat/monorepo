import { NextRequest, NextResponse } from "next/server";
import { ConnectError } from "@connectrpc/connect";
import { GrpcCode, grpcCodeToHttpStatus } from "./grpc-errors";
import { httpStatusToErrorCode } from "./errors";
import { getDefaultMessage } from "./error-messages";
import { ACCESS_COOKIE } from "./auth/cookies";

export function requireAuth(req: NextRequest): NextResponse | null {
  if (req.cookies.get(ACCESS_COOKIE)?.value) return null;
  return NextResponse.json(
    { error: "ログインしてください" },
    { status: 401 }
  );
}

export function extractPaginationParams(
  searchParams: URLSearchParams,
  defaultLimit = 20
): { limit: number; cursor: string } {
  return {
    limit: parseInt(searchParams.get("limit") || String(defaultLimit), 10),
    cursor: searchParams.get("cursor") || "",
  };
}

export function handleApiError(error: unknown, context?: string): NextResponse {
  if (error instanceof ConnectError) {
    const status = grpcCodeToHttpStatus(error.code);
    const code = httpStatusToErrorCode(status);
    const message =
      error.code === GrpcCode.INVALID_ARGUMENT && error.rawMessage
        ? error.rawMessage
        : getDefaultMessage(code);
    if (context) {
      console.error(`[${context}] gRPC error (${error.code}):`, error.rawMessage);
    }
    return NextResponse.json({ error: message }, { status });
  }

  if (context) {
    console.error(`[${context}] Error:`, error);
  }
  return NextResponse.json(
    { error: "予期しないエラーが発生しました" },
    { status: 500 }
  );
}
