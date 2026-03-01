import { NextRequest, NextResponse } from "next/server";
import { castClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const slug = req.nextUrl.searchParams.get("slug");
    if (!slug) {
      return NextResponse.json({ error: "Slug is required" }, { status: 400 });
    }

    const response = await castClient.checkSlugAvailability(
      { slug },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({
      available: response.available,
      message: response.message,
    });
  } catch (error: unknown) {
    return handleApiError(error, "CheckSlugAvailability");
  }
}
