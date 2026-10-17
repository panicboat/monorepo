import { NextRequest } from "next/server";
import { karteClient } from "@/lib/grpc";
import { requireAuth } from "@/lib/api-helpers";
import { parseRating } from "@/modules/karte/lib/input";
import { respondWithKarte } from "../../karte-response";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireAuth(req);
  if (authError) return authError;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  return respondWithKarte(req, "UpdateKarteRating", (headers) =>
    karteClient.updateKarteRating({ karteId: id, rating: parseRating(body?.rating) }, { headers })
  );
}
