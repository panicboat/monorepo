import { NextRequest, NextResponse } from "next/server";
import { castClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";

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
    console.error("ListGenres Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
