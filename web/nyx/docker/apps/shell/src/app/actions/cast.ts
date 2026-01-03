"use server";

import { castClient } from "@/lib/rpc";
import { GetProfileRequest, ListCastsRequest, CastStatus, UpdateStatusRequest, CreateProfileRequest, GetProfileResponse, ListCastsResponse, UpdateStatusResponse } from "@nyx/rpc/cast/v1/service_pb";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function getAuthHeaders() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  const headers: Record<string, string> = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return { headers };
}

// Fetch Cast Profile with Plans
// If userId is not provided, fetches the current user's profile
export async function getCastProfile(userId: string) {
  try {
    const request = new GetProfileRequest({ userId });
    // Public endpoint? Maybe doesn't need auth, but safer to pass if available.
    const response = await castClient.getProfile(request, await getAuthHeaders()) as GetProfileResponse;

    return {
      profile: {
        userId: response.profile?.userId,
        name: response.profile?.name,
        bio: response.profile?.bio,
        imageUrl: response.profile?.imageUrl,
        status: response.profile?.status,
        promiseRate: response.profile?.promiseRate,
      },
      plans: response.plans.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        durationMinutes: p.durationMinutes
      }))
    };
  } catch (error) {
    // console.error("Failed to fetch cast profile:", error);
    return null;
  }
}

// List Casts (for Home Page)
export async function listCasts(statusFilter?: CastStatus) {
  try {
    const request = new ListCastsRequest({
      statusFilter: statusFilter || CastStatus.UNSPECIFIED
    });
    // Public endpoint
    const response = await castClient.listCasts(request, await getAuthHeaders()) as ListCastsResponse;

    return response.items.map(item => ({
      profile: {
        userId: item.profile?.userId,
        name: item.profile?.name,
        imageUrl: item.profile?.imageUrl,
        status: item.profile?.status,
        promiseRate: item.profile?.promiseRate,
      },
      minPrice: item.plans.length > 0 ? Math.min(...item.plans.map(p => p.price)) : 0
    }));
  } catch (error) {
    console.error("Failed to list casts:", error);
    return [];
  }
}

// Update Cast Status
export async function updateCastStatus(status: CastStatus) {
  try {
    const request = new UpdateStatusRequest({ status });
    const response = await castClient.updateStatus(request, await getAuthHeaders()) as UpdateStatusResponse;
    revalidatePath("/cast/dashboard");
    revalidatePath("/casts/[id]");
    return response.status;
  } catch (error) {
    console.error("Failed to update status:", error);
    return null;
  }
}

export async function createProfileAction(formData: FormData) {
  const name = formData.get("name") as string;
  const bio = formData.get("bio") as string || "よろしくお願いします！";
  const planName = formData.get("planName") as string;
  const planPrice = parseInt(formData.get("planPrice") as string || "10000");
  const planDuration = parseInt(formData.get("planDuration") as string || "60");
  const userId = "1"; // Hardcoded for MVP

  const req = new CreateProfileRequest({
    name,
    bio,
    imageUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=" + name, // Placeholder
    userId: userId, // Added field
    plans: [
      {
        name: planName,
        price: planPrice,
        durationMinutes: planDuration,
      }
    ]
  });

  try {
    // Needs auth headers likely, but maybe not if we rely on session cookie being passed automatically?
    // connect client usually needs headers passed explicitly in Node environment.
    await castClient.createProfile(req, await getAuthHeaders());
  } catch (e) {
    console.error("CreateProfile failed", e);
    throw e;
  }

  redirect("/cast/dashboard");
}
