import {
  Bell,
  Bookmark,
  ClipboardList,
  Footprints,
  House,
  Mail,
  Search,
  Settings,
  Star,
  Trophy,
  User,
  type LucideIcon,
} from "lucide-react";

export type FeatureIconKey =
  | "home"
  | "search"
  | "notifications"
  | "messages"
  | "footprints"
  | "bookmarks"
  | "ranking"
  | "karte"
  | "reviews"
  | "profile"
  | "settings";

export const FEATURE_ICONS: Record<FeatureIconKey, LucideIcon> = {
  home: House,
  search: Search,
  notifications: Bell,
  messages: Mail,
  footprints: Footprints,
  bookmarks: Bookmark,
  ranking: Trophy,
  karte: ClipboardList,
  reviews: Star,
  profile: User,
  settings: Settings,
};
