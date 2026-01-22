import { NextRequest, NextResponse } from "next/server";
import { identityClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";

export async function POST(req: NextRequest) {
  let body: any = {};
  try {
    body = await req.json();
    const { phoneNumber, password, role } = body;

    const response = await identityClient.login(
      {
        phoneNumber,
        password,
        role,
      },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json(response);
  } catch (error: any) {
    // Code 16 is Unauthenticated (ConnectRPC/gRPC)
    if (error.code === 16) {
      // Clean log for expected failures
      console.warn(`Login failed for ${body?.phoneNumber || 'unknown'}: ${error.rawMessage || error.message}`);
      return NextResponse.json({ error: error.rawMessage || error.message }, { status: 401 });
    }

    console.error("Login Error:", error);
    return NextResponse.json({ error: error.rawMessage || error.message }, { status: 500 });
  }
}
