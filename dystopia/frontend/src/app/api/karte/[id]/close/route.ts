import { NextRequest } from "next/server";
import { karteClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth } from "@/lib/api-helpers";
import { handleKarteApiError } from "@/modules/karte/lib/api-errors";
import { karteEntryResponse } from "@/modules/karte/lib/api-input";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const { id } = await params;
    const res = await karteClient.closeEntry({ entryId: id }, { headers: await buildGrpcHeaders(req) });
    return karteEntryResponse(res.entry);
  } catch (error: unknown) {
    return handleKarteApiError(error, "CloseKarte");
  }
}
