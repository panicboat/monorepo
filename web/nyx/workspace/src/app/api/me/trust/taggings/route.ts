import { NextRequest, NextResponse } from "next/server";
import { trustClient } from "@/lib/grpc";
import { ConnectError } from "@connectrpc/connect";
import { buildGrpcHeaders } from "@/lib/request";

export async function GET(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const targetId = req.nextUrl.searchParams.get("target_id");
    if (!targetId) {
      return NextResponse.json({ error: "target_id is required" }, { status: 400 });
    }

    const response = await trustClient.listTargetTags(
      { targetId },
      { headers: buildGrpcHeaders(req.headers) }
    );

    const taggings = (response.taggings || []).map((t) => ({
      id: t.id,
      tagName: t.tagName,
      taggerId: t.taggerId,
      createdAt: t.createdAt,
    }));

    return NextResponse.json({ taggings });
  } catch (error: unknown) {
    if (error instanceof ConnectError && error.code === 16) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("ListTargetTags Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tagName, targetId } = await req.json();
    if (!tagName || !targetId) {
      return NextResponse.json({ error: "tagName and targetId are required" }, { status: 400 });
    }

    const response = await trustClient.addTagging(
      { tagName, targetId },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({ success: response.success });
  } catch (error: unknown) {
    if (error instanceof ConnectError) {
      if (error.code === 3) {
        return NextResponse.json({ error: "Tag name is required" }, { status: 400 });
      }
      if (error.code === 6) {
        return NextResponse.json({ error: "Tagging already exists" }, { status: 409 });
      }
      if (error.code === 16) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
    console.error("AddTagging Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
