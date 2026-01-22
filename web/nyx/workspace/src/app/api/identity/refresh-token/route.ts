import { NextRequest, NextResponse } from "next/server";
import { identityClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { refreshToken } = body;

    const response = await identityClient.refreshToken(
      { refreshToken },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json(response);
  } catch (error: any) {
    if (error.code === 16) {
       return NextResponse.json({ error: "Invalid refresh token" }, { status: 401 });
    }
    console.error("RefreshToken Error:", error);
    return NextResponse.json({ error: error.rawMessage || error.message }, { status: 500 });
  }
}
