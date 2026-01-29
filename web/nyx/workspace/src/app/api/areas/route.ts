import { NextResponse } from "next/server";
import { castClient } from "@/lib/grpc";

export async function GET() {
  try {
    const response = await castClient.listAreas({});

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
