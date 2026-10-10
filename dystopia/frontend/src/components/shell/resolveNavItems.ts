export type NavBadgeKey = "unread" | "messaging_unread" | "footprints_unread";

export interface NavItem {
  path: string;
  label: string;
  icon: string;
  badgeKey?: NavBadgeKey;
}

export const PROFILE_NAV_PATH = "__profile__";

interface NavContext {
  karteAccess: boolean;
  isGuest: boolean;
}

export function resolveNavItems({ karteAccess, isGuest }: NavContext): NavItem[] {
  return [
    { path: "/", label: "ホーム", icon: "🏠" },
    { path: "/search", label: "検索", icon: "🔍" },
    { path: "/notifications", label: "通知", icon: "🔔", badgeKey: "unread" },
    { path: "/messages", label: "メッセージ", icon: "💬", badgeKey: "messaging_unread" },
    { path: "/footprints", label: "足跡", icon: "👣", badgeKey: "footprints_unread" },
    { path: "/bookmarks", label: "ブックマーク", icon: "🔖" },
    { path: "/ranking", label: "ランキング", icon: "🏆" },
    ...(karteAccess ? [{ path: "/karte/my", label: "カルテ", icon: "📋" }] : []),
    ...(isGuest ? [{ path: "/reviews/my", label: "レビュー", icon: "📝" }] : []),
    { path: PROFILE_NAV_PATH, label: "プロフィール", icon: "👤" },
    { path: "/settings", label: "設定", icon: "⚙" },
  ];
}
