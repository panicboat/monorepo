import { NextRequest, NextResponse } from "next/server";
import { castClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const response = await castClient.listAreas(
      {},
      { headers: buildGrpcHeaders(req.headers) }
    );

    // FALLBACK: Returns empty array when response areas is missing
    const areas = (response.areas || []).map((a) => ({
      id: a.id,
      prefecture: a.prefecture,
      name: a.name,
      code: a.code,
    }));

    return NextResponse.json({ areas });
  } catch (error: unknown) {
    return handleApiError(error, "ListAreas");
  }
}
