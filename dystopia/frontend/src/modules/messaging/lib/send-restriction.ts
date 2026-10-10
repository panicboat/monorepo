import { SendRestriction } from "@/stub/messaging/v1/messaging_service_pb";
import type { SendRestrictionView } from "../types";

export const FOLLOW_REQUIRED_REASON = "follow_required";

export const SEND_RESTRICTION_MESSAGES: Record<Exclude<SendRestrictionView, "none">, string> = {
  follow_required: "相手をフォローするとメッセージを送れます",
  blocked: "この相手とはメッセージを送受信できません",
  counterpart_unavailable: "相手のプロフィールが利用できないため、メッセージを送れません",
};

const VIEW_BY_PROTO: Partial<Record<SendRestriction, SendRestrictionView>> = {
  [SendRestriction.FOLLOW_REQUIRED]: "follow_required",
  [SendRestriction.BLOCKED]: "blocked",
  [SendRestriction.COUNTERPART_UNAVAILABLE]: "counterpart_unavailable",
};

export function sendRestrictionProtoToView(restriction: SendRestriction): SendRestrictionView {
  // FALLBACK: Treat a value this build does not know as sendable, since the server still decides on each send.
  return VIEW_BY_PROTO[restriction] ?? "none";
}
