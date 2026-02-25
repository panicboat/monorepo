import { NextRequest, NextResponse } from "next/server";
import { castClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const response = await castClient.listGenres(
      {},
      { headers: buildGrpcHeaders(req.headers) }
    );

    const genres = (response.genres || []).map((g) => ({
      id: g.id,
      name: g.name,
      slug: g.slug,
      displayOrder: g.displayOrder,
    }));

    return NextResponse.json({ genres });
  } catch (error: unknown) {
    return handleApiError(error, "ListGenres");
  }
}
