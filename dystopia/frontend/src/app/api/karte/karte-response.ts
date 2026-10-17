import { NextRequest, NextResponse } from "next/server";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError } from "@/lib/api-helpers";
import { mapKarteToView } from "@/modules/karte/lib/mappers";
import type { Karte as KarteMessage } from "@/stub/karte/v1/service_pb";

type GrpcHeaders = Awaited<ReturnType<typeof buildGrpcHeaders>>;

export async function respondWithKarte(
  req: NextRequest,
  label: string,
  call: (headers: GrpcHeaders) => Promise<{ karte?: KarteMessage }>
) {
  try {
    const res = await call(await buildGrpcHeaders(req));
    if (!res.karte) {
      return NextResponse.json({ error: `${label} returned no karte` }, { status: 500 });
    }
    return NextResponse.json({ karte: mapKarteToView(res.karte) });
  } catch (error: unknown) {
    return handleApiError(error, label);
  }
}
