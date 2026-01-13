import { NextRequest, NextResponse } from "next/server";
import { identityClient } from "@/lib/grpc";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const response = await identityClient.getCurrentUser(
      {},
      {
        headers: {
          Authorization: authHeader,
        },
      }
    );

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("GetCurrentUser Error:", error);
    // Map gRPC errors to HTTP status if possible, or just 500/401
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
}
