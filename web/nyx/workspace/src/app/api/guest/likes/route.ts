import { NextRequest, NextResponse } from "next/server";
import { socialClient } from "@/lib/grpc";
import { ConnectError } from "@connectrpc/connect";
import { buildGrpcHeaders } from "@/lib/request";

export async function POST(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { postId } = body;

    if (!postId) {
      return NextResponse.json({ error: "postId is required" }, { status: 400 });
    }

    const response = await socialClient.likeCastPost(
      { postId },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({
      likesCount: response.likesCount,
    });
  } catch (error: unknown) {
    if (error instanceof ConnectError) {
      if (error.code === 5) {
        return NextResponse.json({ error: "Post not found" }, { status: 404 });
      }
      if (error.code === 16) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
    console.error("LikeCastPost Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const postId = req.nextUrl.searchParams.get("post_id");

    if (!postId) {
      return NextResponse.json({ error: "post_id is required" }, { status: 400 });
    }

    const response = await socialClient.unlikeCastPost(
      { postId },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({
      likesCount: response.likesCount,
    });
  } catch (error: unknown) {
    if (error instanceof ConnectError) {
      if (error.code === 5) {
        return NextResponse.json({ error: "Post not found" }, { status: 404 });
      }
      if (error.code === 16) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
    console.error("UnlikeCastPost Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
