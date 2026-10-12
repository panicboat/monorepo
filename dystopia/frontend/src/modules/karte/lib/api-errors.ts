import { NextResponse } from "next/server";
import { Code, ConnectError } from "@connectrpc/connect";
import { handleApiError } from "@/lib/api-helpers";

export class KarteInputError extends Error {}

export function handleKarteApiError(error: unknown, context: string): NextResponse {
  if (error instanceof KarteInputError || error instanceof SyntaxError) return NextResponse.json({ error: error instanceof KarteInputError ? error.message : "JSONの入力が正しくありません" }, { status: 400 });
  if (error instanceof ConnectError && error.code === Code.FailedPrecondition) return NextResponse.json({ error: error.rawMessage || "現在の状態では変更できません" }, { status: 409 });
  return handleApiError(error, context);
}
