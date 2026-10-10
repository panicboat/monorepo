import type { LucideIcon } from "lucide-react";
import { FEATURE_ICONS } from "@/components/ui/feature-icons";

export type NavBadgeKey = "unread" | "messaging_unread" | "footprints_unread";

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  badgeKey?: NavBadgeKey;
}

export const PROFILE_NAV_PATH = "__profile__";

interface NavContext {
  karteAccess: boolean;
  isGuest: boolean;
}

export function resolveNavItems({ karteAccess, isGuest }: NavContext): NavItem[] {
  return [
    { path: "/", label: "ホーム", icon: FEATURE_ICONS.home },
    { path: "/search", label: "検索", icon: FEATURE_ICONS.search },
    { path: "/notifications", label: "通知", icon: FEATURE_ICONS.notifications, badgeKey: "unread" },
    { path: "/messages", label: "メッセージ", icon: FEATURE_ICONS.messages, badgeKey: "messaging_unread" },
    { path: "/footprints", label: "足跡", icon: FEATURE_ICONS.footprints, badgeKey: "footprints_unread" },
    { path: "/bookmarks", label: "ブックマーク", icon: FEATURE_ICONS.bookmarks },
    { path: "/ranking", label: "ランキング", icon: FEATURE_ICONS.ranking },
    ...(karteAccess ? [{ path: "/karte/my", label: "カルテ", icon: FEATURE_ICONS.karte }] : []),
    ...(isGuest ? [{ path: "/reviews/my", label: "レビュー", icon: FEATURE_ICONS.reviews }] : []),
    { path: PROFILE_NAV_PATH, label: "プロフィール", icon: FEATURE_ICONS.profile },
    { path: "/settings", label: "設定", icon: FEATURE_ICONS.settings },
  ];
}
