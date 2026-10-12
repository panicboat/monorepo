import { NextRequest, NextResponse } from "next/server";
import type { KarteEntry } from "@/stub/karte/v1/service_pb";
import type { KarteEventInput } from "../types";
import { validateEvent, validateKarte, validateRating } from "./validation";
import { KarteInputError } from "./api-errors";
import { mapKarteEntryToView } from "./mappers";

export async function readKarteBody(req: NextRequest): Promise<Record<string, unknown>> {
  const body: unknown = await req.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new KarteInputError("入力はJSONオブジェクトにしてください");
  return body as Record<string, unknown>;
}

export function eventInput(input: unknown): KarteEventInput {
  const errors = validateEvent(input);
  if (Object.keys(errors).length) throw new KarteInputError(Object.values(errors)[0]);
  const value = input as KarteEventInput;
  return { stage: value.stage, outcome: value.outcome, tags: value.tags ?? [], note: value.note ?? "", occurredOn: value.occurredOn };
}

export function entryInput(body: Record<string, unknown>): { rating?: number; body?: string } {
  const error = validateRating(body.rating);
  if (error) throw new KarteInputError(error);
  const bodyErrors = validateKarte({ body: body.body });
  if (Object.keys(bodyErrors).length) throw new KarteInputError(Object.values(bodyErrors)[0]);
  return { ...(Object.hasOwn(body, "rating") ? { rating: body.rating === null ? 0 : body.rating as number } : {}), ...(Object.hasOwn(body, "body") ? { body: body.body === null ? "" : body.body as string } : {}) };
}

export function karteEntryResponse(entry: KarteEntry | undefined): NextResponse {
  return entry ? NextResponse.json({ entry: mapKarteEntryToView(entry) }) : NextResponse.json({ error: "カルテが返されませんでした" }, { status: 502 });
}
