import type { DisplayLanguage, ServerMessage } from "../../shared/meeting.js";

export type ClarificationRequest = Extract<ServerMessage, { type: "clarification:requested" }>;

export const clarificationRequestCopy = (
  request: ClarificationRequest,
  language: DisplayLanguage,
): string => language === "ja"
  ? `${request.requester.displayName}さんがこの発言の確認を依頼しました。`
  : `${request.requester.displayName} requested clarification for this statement.`;
