import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";

export async function PUT(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json({ error: "Missing key" }, { status: 400 });
    }

    // Security: prevent directory traversal
    if (key.includes("..")) {
      return NextResponse.json({ error: "Invalid key" }, { status: 400 });
    }

    const body = await req.arrayBuffer();
    const buffer = Buffer.from(body);

    // Save to public/uploads directory
    const uploadPath = join(process.cwd(), "public", "uploads", key);
    const uploadDir = dirname(uploadPath);

    await mkdir(uploadDir, { recursive: true });
    await writeFile(uploadPath, buffer);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Storage upload error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
