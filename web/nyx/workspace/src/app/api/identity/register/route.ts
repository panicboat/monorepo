import { NextRequest, NextResponse } from "next/server";
import { identityClient } from "@/lib/grpc";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phoneNumber, password, verificationToken } = body;

    const response = await identityClient.register({
      phoneNumber,
      password,
      verificationToken,
    });

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Register Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
