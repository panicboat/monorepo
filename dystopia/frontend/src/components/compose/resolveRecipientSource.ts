import type { Role } from "@/lib/auth";
import type { ComposeKind } from "./resolveComposeKinds";

export type RecipientKind = Exclude<ComposeKind, "post">;

export interface RecipientSource {
  title: string;
  listLabel: string;
  initial: "following" | "followers";
  role: Role | null;
  search: "everyone" | "among-initial";
  emptyHint: string;
}

const SEARCH_HINT = "まだ候補がいません。名前やユーザー名で探せます";

export function resolveRecipientSource(kind: RecipientKind, viewerRole: Role | null): RecipientSource {
  if (kind === "karte") {
    return { title: "カルテを書くゲストを選ぶ", listLabel: "フォロワーのゲスト", initial: "followers", role: "guest", search: "everyone", emptyHint: SEARCH_HINT };
  }
  if (kind === "review") {
    return { title: "レビューするキャストを選ぶ", listLabel: "フォロー中のキャスト", initial: "following", role: "cast", search: "everyone", emptyHint: SEARCH_HINT };
  }
  // A guest may only message a cast they follow, so a guest's search stays inside that list.
  const followedOnly = viewerRole === "guest";
  return {
    title: "メッセージの相手を選ぶ",
    listLabel: "フォロー中",
    initial: "following",
    role: null,
    search: followedOnly ? "among-initial" : "everyone",
    emptyHint: followedOnly ? "フォローしているキャストにメッセージを送れます" : SEARCH_HINT,
  };
}
