import { NextRequest, NextResponse } from "next/server";
import { socialClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";

export async function GET(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cursor = req.nextUrl.searchParams.get("cursor") || "";
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20", 10);

    const response = await socialClient.listCastPosts(
      { castId: "", limit, cursor },
      { headers: buildGrpcHeaders(req.headers) }
    );

    // Explicitly map to ensure all fields are serialized
    const posts = response.posts.map((post) => ({
      id: post.id,
      castId: post.castId,
      content: post.content,
      media: post.media.map((m) => ({
        id: m.id,
        mediaType: m.mediaType,
        url: m.url,
        thumbnailUrl: m.thumbnailUrl,
      })),
      createdAt: post.createdAt,
      author: post.author
        ? {
            id: post.author.id,
            name: post.author.name,
            imageUrl: post.author.imageUrl,
          }
        : null,
      likesCount: post.likesCount,
      commentsCount: post.commentsCount,
      visibility: post.visibility,
      hashtags: post.hashtags,
      liked: post.liked,
    }));

    return NextResponse.json({
      posts,
      nextCursor: response.nextCursor,
      hasMore: response.hasMore,
    });
  } catch (error: any) {
    console.error("ListCastPosts Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const response = await socialClient.saveCastPost(
      {
        id: body.id || "",
        content: body.content,
        media: body.media || [],
        visibility: body.visibility || "public",
        hashtags: body.hashtags || [],
      },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({ post: response.post });
  } catch (error: any) {
    console.error("SaveCastPost Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    await socialClient.deleteCastPost(
      { id: body.id },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DeleteCastPost Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
