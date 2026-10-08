import type { KarteEntry as KarteEntryMessage } from "@/stub/karte/v1/service_pb";
import type { KarteEntry } from "@/modules/karte/types";

function toIsoString(timestamp: { seconds: bigint } | undefined): string {
  return timestamp ? new Date(Number(timestamp.seconds) * 1000).toISOString() : "";
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
    rating: entry.rating,
    body: entry.body || "",
    flagged: !!entry.flagged,
    createdAt: toIsoString(entry.createdAt),
    updatedAt: toIsoString(entry.updatedAt),
  };
}
