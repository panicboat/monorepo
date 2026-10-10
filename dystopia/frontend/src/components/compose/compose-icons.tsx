import type { ReactNode } from "react";
import { PenLine } from "lucide-react";
import { FEATURE_ICONS } from "@/components/ui/feature-icons";
import type { ComposeKind } from "./resolveComposeKinds";

const ICON_CLASS = "size-[22px]";

export const COMPOSE_ICONS: Record<ComposeKind, ReactNode> = {
  post: <PenLine className={ICON_CLASS} />,
  message: <FEATURE_ICONS.messages className={ICON_CLASS} />,
  karte: <FEATURE_ICONS.karte className={ICON_CLASS} />,
  review: <FEATURE_ICONS.reviews className={ICON_CLASS} />,
};

export const COMPOSE_LABELS: Record<ComposeKind, string> = {
  post: "投稿",
  message: "メッセージ",
  karte: "カルテ",
  review: "レビュー",
};
