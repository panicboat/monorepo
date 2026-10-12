import type { KarteEntry as KarteEntryMessage, KarteEvent as KarteEventMessage } from "@/stub/karte/v1/service_pb";
import type { KarteEntry, KarteEvent, KarteStage } from "@/modules/karte/types";

function toIsoString(timestamp: { seconds: bigint; nanos: number } | undefined): string {
  return timestamp ? new Date(Number(timestamp.seconds) * 1000 + timestamp.nanos / 1_000_000).toISOString() : "";
}

function mapEvent(event: KarteEventMessage): KarteEvent {
  return { id: event.id, entryId: event.entryId, stage: event.stage as KarteStage, outcome: event.outcome, tags: [...event.tags], note: event.note, occurredOn: event.occurredOn, createdAt: toIsoString(event.createdAt), updatedAt: toIsoString(event.updatedAt) };
}

export function mapKarteEntryToView(entry: KarteEntryMessage): KarteEntry {
  return {
    id: entry.id,
    authorProfileId: entry.authorProfileId,
    targetProfileId: entry.targetProfileId,
    isMine: !!entry.isMine,
    authorUsername: entry.authorUsername || "",
    authorAvatarUrl: entry.authorAvatarUrl || "",
    targetUsername: entry.targetUsername || "",
    targetAvatarUrl: entry.targetAvatarUrl || "",
    rating: entry.rating ?? null,
    body: entry.body || "",
    flagged: !!entry.flagged,
    createdAt: toIsoString(entry.createdAt),
    updatedAt: toIsoString(entry.updatedAt),
    status: entry.status === "open" ? "open" : "closed",
    closedAt: entry.closedAt ? toIsoString(entry.closedAt) : null,
    events: entry.events.map(mapEvent),
    latestEvent: entry.latestEvent ? mapEvent(entry.latestEvent) : null,
    eventCount: entry.eventCount,
  };
}
