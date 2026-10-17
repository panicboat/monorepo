import type { Footprint as FootprintProto } from "@/stub/footprints/v1/footprints_service_pb";
import { summaryToView } from "@/modules/profile/lib/mappers";
import type { FootprintView } from "../types";

export function mapFootprintToView(proto: FootprintProto): FootprintView {
  const visitor = proto.visitor;
  const lastVisited = proto.lastVisitedAt;
  const lastVisitedAtIso = lastVisited
    ? new Date(
        Number(lastVisited.seconds) * 1000 +
          Math.floor(Number(lastVisited.nanos) / 1_000_000)
      ).toISOString()
    : "";

  return {
    visitor: visitor ? summaryToView(visitor) : null,
    lastVisitedAt: lastVisitedAtIso,
    isUnread: !!proto.isUnread,
    visitCount: proto.visitCount || 0,
  };
}
