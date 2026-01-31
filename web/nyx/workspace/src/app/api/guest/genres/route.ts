import { NextResponse } from "next/server";
import { castClient } from "@/lib/grpc";

export async function GET() {
  try {
    const response = await castClient.listGenres({});

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
