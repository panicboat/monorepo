import { NextRequest, NextResponse } from "next/server";
import { identityClient } from "@/lib/grpc";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { refreshToken } = body;

    const response = await identityClient.logout({
      refreshToken,
    });

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Logout Error:", error);
    return NextResponse.json({ error: error.rawMessage || error.message }, { status: 500 });
  }
}
