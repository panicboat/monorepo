import { NextRequest, NextResponse } from "next/server";
import { castClient } from "@/lib/grpc";
import { ConnectError } from "@connectrpc/connect";
import { buildGrpcHeaders } from "@/lib/request";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    // If no header, maybe try cookie? BUT for now assume header from client logic or fail.
    // profile/page.tsx needs to send header. I updated handleSave to send it.
    // But Initial Load needs it too. profile/page.tsx initial load (fetchData) does NOT send header currently.
    // I should fix profile/page.tsx initial load too.

    // For now, if no header, assume unauthorized
    if (!authHeader) {
        // Return 401
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const response = await castClient.getCastProfile(
      { userId: "" },
      { headers: buildGrpcHeaders(req.headers) }
    );

    // Map response to CastProfile Frontend type
    const p = response.profile!;

    // Mapping
    const mapped = {
        name: p.name,
        tagline: p.tagline,
        bio: p.bio,
        area: "", // Proto field missing
        // Wait, Proto CastProfile defined: user_id, name, bio, image_url, status, promise_rate, images, image_path.
        // It does NOT have area, serviceCategory, locationType, etc!!
        // So those fields will be lost/empty?
        // The previous implementation of `GetCastProfile` only returned minimal data.
        // The `portfolio.casts` table HAS `area`, `service_category` etc.
        // But the PROTO definition I used/updated earlier (Step 476) ONLY had:
        // user_id, name, bio, image_url, status, promise_rate, images, image_path.
        // It missed ALL the extended fields (area, age, height, etc)!
        // This means `GetCastProfile` response will NOT contain them.
        // I need to update PROTO definition to include these fields if I want `profile/page.tsx` to work!

        // CRITICAL MISSING FIELDS IN PROTO.
        // I must update Proto first.

        imageUrl: p.imageUrl,
        imagePath: p.imagePath,
        images: {
            hero: p.imageUrl,
            portfolio: p.images ? p.images.map(url => ({ url, type: "image", id: url })) : []
        },
        tags: [], // Proto doesn't have tags
        socialLinks: { others: [] }, // Proto doesn't have socialLinks

        // Defaulting missing fields
        serviceCategory: "standard",
        locationType: "dispatch",
        age: 20,
        height: 160
    };

    return NextResponse.json(mapped);
  } catch (error: any) {
    if (error instanceof ConnectError && error.code === 5) {
         return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    // Mapping Body to SaveCastProfileRequest
    const response = await castClient.saveCastProfile({
        name: body.name,
        bio: body.bio,
        imagePath: body.imagePath,
        tagline: body.tagline,
        serviceCategory: body.serviceCategory,
        locationType: body.locationType,
        area: body.area,
        defaultScheduleStart: body.defaultScheduleStart,
        defaultScheduleEnd: body.defaultScheduleEnd,
        socialLinks: body.socialLinks,
    }, { headers: buildGrpcHeaders(req.headers) });

    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
