import { NextRequest } from "next/server";
import { karteClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth } from "@/lib/api-helpers";
import { handleKarteApiError, KarteInputError } from "@/modules/karte/lib/api-errors";
import { entryInput, eventInput, karteEntryResponse, readKarteBody } from "@/modules/karte/lib/api-input";
import { validateKarte } from "@/modules/karte/lib/validation";

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const body = await readKarteBody(req);
    const targetProfileId = body.targetProfileId;
    if (typeof targetProfileId !== "string" || !targetProfileId) throw new KarteInputError("ゲストを選択してください");
    const firstEvent = eventInput(body.firstEvent);
    const errors = validateKarte({ ...body, events: [firstEvent] });
    if (Object.keys(errors).length) throw new KarteInputError(Object.values(errors)[0]);
    const res = await karteClient.createEntry(
      { targetProfileId, ...entryInput(body), firstEvent },
      { headers: await buildGrpcHeaders(req) }
    );
    return karteEntryResponse(res.entry);
  } catch (error: unknown) {
    return handleKarteApiError(error, "CreateKarte");
  }
}
