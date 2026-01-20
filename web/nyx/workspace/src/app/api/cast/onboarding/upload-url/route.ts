import { NextRequest, NextResponse } from "next/server";
import { castClient } from "@/lib/grpc";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { filename, contentType } = await req.json();

    const response = await castClient.getUploadUrl(
      { filename, contentType },
      {
        headers: {
          Authorization: authHeader,
        },
      }
    );

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("GetUploadUrl Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
