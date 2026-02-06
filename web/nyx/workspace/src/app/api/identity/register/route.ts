import { NextRequest, NextResponse } from "next/server";
import { identityClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phoneNumber, password, verificationToken, role } = body;

    const response = await identityClient.register(
      {
        phoneNumber,
        password,
        verificationToken,
        role,
      },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error("Register Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
