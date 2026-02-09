import { NextRequest, NextResponse } from "next/server";
import { favoriteClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";

export async function GET(req: NextRequest) {
  try {
    const castIdsParam = req.nextUrl.searchParams.get("cast_ids");

    if (!castIdsParam) {
      return NextResponse.json({ error: "cast_ids is required" }, { status: 400 });
    }

    const castIds = castIdsParam.split(",").filter(Boolean);

    if (castIds.length === 0) {
      return NextResponse.json({ favorited: {} });
    }

    const response = await favoriteClient.getFavoriteStatus(
      { castIds },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({
      favorited: response.favorited,
    });
  } catch (error: unknown) {
    console.error("GetFavoriteStatus Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
