import { NextRequest, NextResponse } from "next/server";
import { identityClient } from "@/lib/grpc";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import {
  callWithRefresh,
  applyRefreshedCookies,
} from "@/lib/auth/refresh-on-unauthenticated";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const result = await callWithRefresh(req, (headers) =>
      identityClient.getCurrentAccount({}, { headers })
    );
    if (!result.ok) return result.response;

    const res = NextResponse.json(result.data);
    return applyRefreshedCookies(res, result.refreshed);
  } catch (error: unknown) {
    return handleApiError(error, "GetCurrentUser");
  }
}
