import { NextRequest, NextResponse } from "next/server";
import { identityClient } from "@/lib/grpc";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phoneNumber } = body;

    const response = await identityClient.sendSms({ phoneNumber });

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("SendSms Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
