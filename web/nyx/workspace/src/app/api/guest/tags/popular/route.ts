import { NextRequest, NextResponse } from "next/server";
import { castClient } from "@/lib/grpc";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const response = await castClient.listPopularTags({ limit });

    const tags = (response.tags || []).map((t) => ({
      name: t.name,
      usageCount: t.usageCount,
    }));

    return NextResponse.json({ tags });
  } catch (error: unknown) {
    console.error("ListPopularTags Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
