import { NextRequest, NextResponse } from "next/server";
import { identityClient } from "@/lib/grpc";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phoneNumber, password } = body;

    const response = await identityClient.login({
      phoneNumber,
      password,
    });

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Login Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
