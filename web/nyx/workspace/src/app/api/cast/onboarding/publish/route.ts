import { NextRequest, NextResponse } from "next/server";
import { castClient } from "@/lib/grpc";
import { CastStatus } from "@/lib/portfolio/v1/service_pb";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const status = body.status === "online" ? CastStatus.ONLINE : CastStatus.OFFLINE;
    // Or assume "publish" means ONLINE.

    const response = await castClient.updateCastStatus(
      {
        status: status,
      },
      {
        headers: {
          Authorization: authHeader,
        },
      }
    );

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("UpdateCastStatus Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
