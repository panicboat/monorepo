import { NextRequest, NextResponse } from "next/server";
import { ConnectError } from "@connectrpc/connect";
import { grpcCodeToHttpStatus } from "./grpc-errors";
import { httpStatusToErrorCode } from "./errors";
import { getDefaultMessage } from "./error-messages";

export function requireAuth(req: NextRequest): NextResponse | null {
  if (!req.headers.get("authorization")) {
    return NextResponse.json(
      { error: "ログインしてください" },
      { status: 401 }
    );
  }
  return null;
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
    const message = getDefaultMessage(code);
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
