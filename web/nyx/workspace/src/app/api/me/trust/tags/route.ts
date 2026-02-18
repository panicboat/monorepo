import { NextRequest, NextResponse } from "next/server";
import { trustClient } from "@/lib/grpc";
import { ConnectError } from "@connectrpc/connect";
import { buildGrpcHeaders } from "@/lib/request";

export async function GET(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const response = await trustClient.listTags(
      {},
      { headers: buildGrpcHeaders(req.headers) }
    );

    const tags = (response.tags || []).map((tag) => ({
      id: tag.id,
      name: tag.name,
      createdAt: tag.createdAt,
    }));

    return NextResponse.json({ tags });
  } catch (error: unknown) {
    if (error instanceof ConnectError && error.code === 16) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("ListTags Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name } = await req.json();
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const response = await trustClient.createTag(
      { name },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({
      success: response.success,
      tag: response.tag
        ? { id: response.tag.id, name: response.tag.name, createdAt: response.tag.createdAt }
        : null,
    });
  } catch (error: unknown) {
    if (error instanceof ConnectError) {
      if (error.code === 6) {
        return NextResponse.json({ error: "Tag already exists" }, { status: 409 });
      }
      if (error.code === 8) {
        return NextResponse.json({ error: "Tag limit reached" }, { status: 429 });
      }
      if (error.code === 16) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
    console.error("CreateTag Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
