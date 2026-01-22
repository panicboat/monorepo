import { NextRequest, NextResponse } from "next/server";
import { identityClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phoneNumber, code } = body;

    const response = await identityClient.verifySms(
      { phoneNumber, code },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("VerifySms Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
