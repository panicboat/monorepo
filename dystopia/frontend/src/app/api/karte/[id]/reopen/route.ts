import { NextRequest } from "next/server";
import { karteClient } from "@/lib/grpc";
import { requireAuth } from "@/lib/api-helpers";
import { respondWithKarte } from "../../karte-response";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireAuth(req);
  if (authError) return authError;
  const { id } = await params;
  return respondWithKarte(req, "ReopenKarte", (headers) => karteClient.reopenKarte({ karteId: id }, { headers }));
}
