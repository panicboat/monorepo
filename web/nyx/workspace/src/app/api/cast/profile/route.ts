import { NextRequest, NextResponse } from "next/server";
import { castClient } from "@/lib/grpc";
import { ConnectError } from "@connectrpc/connect";
import { buildGrpcHeaders } from "@/lib/request";
import { getMediaType } from "@/lib/media";

export async function GET(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
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
        area: p.area || "",
        serviceCategory: p.serviceCategory || "standard",
        locationType: p.locationType || "dispatch",
        defaultScheduleStart: p.defaultScheduleStart || "18:00",
        defaultScheduleEnd: p.defaultScheduleEnd || "23:00",
        imageUrl: p.imageUrl,
        imagePath: p.imagePath,
        images: {
            hero: p.imagePath ? {
                id: "hero",
                url: `/uploads/${p.imagePath}`,
                key: p.imagePath,
                type: getMediaType(p.imagePath)
            } : null,
            portfolio: p.images ? p.images.map((key, index) => ({
                id: `existing-${index}`,
                url: `/uploads/${key}`,
                key: key,
                type: getMediaType(key)
            })) : []
        },
        tags: (p.tags || []).map(t => ({ label: t, count: 1 })),
        socialLinks: p.socialLinks ? {
            x: p.socialLinks.x || "",
            instagram: p.socialLinks.instagram || "",
            tiktok: p.socialLinks.tiktok || "",
            cityheaven: p.socialLinks.cityheaven || "",
            litlink: p.socialLinks.litlink || "",
            others: p.socialLinks.others || [],
        } : { others: [] },
        age: p.age || undefined,
        height: p.height || undefined,
        bloodType: p.bloodType || undefined,
        threeSizes: p.threeSizes ? {
            b: p.threeSizes.bust || 0,
            w: p.threeSizes.waist || 0,
            h: p.threeSizes.hip || 0,
            cup: p.threeSizes.cup || "",
        } : undefined,
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
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Mapping Body to SaveCastProfileRequest
    // Convert tags from {label, count}[] to string[]
    const tagsArray = Array.isArray(body.tags)
      ? body.tags.map((t: any) => typeof t === "string" ? t : t.label)
      : [];

    const headers = buildGrpcHeaders(req.headers);

    // Save profile
    const profileResponse = await castClient.saveCastProfile({
        name: body.name,
        bio: body.bio,
        imagePath: body.imagePath,
        tagline: body.tagline,
        serviceCategory: body.serviceCategory,
        locationType: body.locationType,
        area: body.area,
        defaultScheduleStart: body.defaultScheduleStart,
        defaultScheduleEnd: body.defaultScheduleEnd,
        socialLinks: body.socialLinks ? {
            x: body.socialLinks.x || "",
            instagram: body.socialLinks.instagram || "",
            tiktok: body.socialLinks.tiktok || "",
            cityheaven: body.socialLinks.cityheaven || "",
            litlink: body.socialLinks.litlink || "",
            others: body.socialLinks.others || [],
        } : undefined,
        age: body.age || 0,
        height: body.height || 0,
        bloodType: body.bloodType || "",
        threeSizes: body.threeSizes ? {
            bust: body.threeSizes.b || body.threeSizes.bust || 0,
            waist: body.threeSizes.w || body.threeSizes.waist || 0,
            hip: body.threeSizes.h || body.threeSizes.hip || 0,
            cup: body.threeSizes.cup || "",
        } : undefined,
        tags: tagsArray,
    }, { headers });

    // Save images if provided
    if (body.imagePath || (body.images && body.images.length > 0)) {
        await castClient.saveCastImages({
            profileImagePath: body.imagePath || "",
            galleryImages: body.images || [],
        }, { headers });
    }

    return NextResponse.json(profileResponse);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
