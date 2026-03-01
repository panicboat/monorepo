import { NextRequest, NextResponse } from "next/server";
import { ConnectError } from "@connectrpc/connect";
import { grpcCodeToHttpStatus } from "./grpc-errors";

export function requireAuth(req: NextRequest): NextResponse | null {
  if (!req.headers.get("authorization")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    const message = error.rawMessage || error.message;
    return NextResponse.json({ error: message }, { status });
  }

  if (context) {
    console.error(`[${context}] Error:`, error);
  }
  const message = error instanceof Error ? error.message : "Internal server error";
  return NextResponse.json({ error: message }, { status: 500 });
}
