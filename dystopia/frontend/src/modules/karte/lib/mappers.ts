import {
  KarteStage as KarteStageMessage,
  KarteStatus as KarteStatusMessage,
  type Karte as KarteMessage,
  type KarteEvent as KarteEventMessage,
  type ReliabilitySummary as ReliabilitySummaryMessage,
} from "@/stub/karte/v1/service_pb";
import type { Karte, KarteEvent, KarteEventInput, KarteStage, ReliabilitySummary } from "@/modules/karte/types";

const STAGE_TO_MESSAGE: Record<KarteStage, KarteStageMessage> = {
  reservation: KarteStageMessage.RESERVATION,
  service: KarteStageMessage.SERVICE,
  aftercare: KarteStageMessage.AFTERCARE,
};

function toIsoString(timestamp: { seconds: bigint } | undefined): string {
  return timestamp ? new Date(Number(timestamp.seconds) * 1000).toISOString() : "";
}

function stageFromMessage(stage: KarteStageMessage): KarteStage {
  if (stage === KarteStageMessage.SERVICE) return "service";
  if (stage === KarteStageMessage.AFTERCARE) return "aftercare";
  // FALLBACK: The server never sends an unspecified stage, so read one as a reservation instead of failing the whole list.
  return "reservation";
}

export function mapKarteEventToView(event: KarteEventMessage): KarteEvent {
  return {
    id: event.id,
    stage: stageFromMessage(event.stage),
    outcome: event.outcome,
    tags: [...event.tags],
    note: event.note || "",
    occurredOn: event.occurredOn,
    createdAt: toIsoString(event.createdAt),
    updatedAt: toIsoString(event.updatedAt),
  };
}

export function mapKarteToView(karte: KarteMessage): Karte {
  return {
    id: karte.id,
    authorProfileId: karte.authorProfileId,
    authorUsername: karte.authorUsername || "",
    authorAvatarUrl: karte.authorAvatarUrl || "",
    targetProfileId: karte.targetProfileId,
    targetUsername: karte.targetUsername || "",
    targetAvatarUrl: karte.targetAvatarUrl || "",
    isMine: !!karte.isMine,
    rating: karte.rating === 0 ? null : karte.rating,
    status: karte.status === KarteStatusMessage.CLOSED ? "closed" : "open",
    events: karte.events.map(mapKarteEventToView),
    createdAt: toIsoString(karte.createdAt),
    updatedAt: toIsoString(karte.updatedAt),
    closedAt: karte.closedAt ? toIsoString(karte.closedAt) : null,
  };
}

export function mapReliabilityToView(summary: ReliabilitySummaryMessage | undefined): ReliabilitySummary {
  const karteCount = summary?.karteCount ?? 0;
  return {
    averageRating: summary && karteCount > 0 ? summary.averageRating : null,
    raterCount: summary?.raterCount ?? 0,
    karteCount,
  };
}

export function eventInputToMessage(input: KarteEventInput) {
  return {
    stage: STAGE_TO_MESSAGE[input.stage],
    outcome: input.outcome,
    tags: input.tags,
    note: input.note,
    occurredOn: input.occurredOn,
  };
}
