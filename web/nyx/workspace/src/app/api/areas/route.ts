import { NextRequest, NextResponse } from "next/server";
import { castClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";

export async function GET(req: NextRequest) {
  try {
    const response = await castClient.listAreas(
      {},
      { headers: buildGrpcHeaders(req.headers) }
    );

    const areas = (response.areas || []).map((a) => ({
      id: a.id,
      prefecture: a.prefecture,
      name: a.name,
      code: a.code,
    }));

    return NextResponse.json({ areas });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
