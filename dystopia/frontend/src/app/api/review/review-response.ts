import { NextRequest, NextResponse } from "next/server";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError } from "@/lib/api-helpers";
import { mapReviewToView } from "@/modules/review/lib/mappers";
import type { Review as ReviewMessage } from "@/stub/review/v1/service_pb";

type GrpcHeaders = Awaited<ReturnType<typeof buildGrpcHeaders>>;

export async function respondWithReview(
  req: NextRequest,
  label: string,
  call: (headers: GrpcHeaders) => Promise<{ review?: ReviewMessage }>,
  { allowDeleted = false }: { allowDeleted?: boolean } = {}
) {
  try {
    const res = await call(await buildGrpcHeaders(req));
    if (!res.review && allowDeleted) {
      return NextResponse.json({ review: null });
    }
    if (!res.review) {
      return NextResponse.json({ error: `${label} returned no review` }, { status: 500 });
    }
    return NextResponse.json({ review: mapReviewToView(res.review) });
  } catch (error: unknown) {
    return handleApiError(error, label);
  }
}
