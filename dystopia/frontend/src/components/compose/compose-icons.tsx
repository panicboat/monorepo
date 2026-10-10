import type { ReactNode } from "react";
import type { ComposeKind } from "./resolveComposeKinds";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const COMPOSE_ICONS: Record<ComposeKind, ReactNode> = {
  post: (
    <Icon>
      <path d="M4 20h4L19 9l-4-4L4 16v4z" />
      <path d="M13.5 6.5l4 4" />
    </Icon>
  ),
  message: (
    <Icon>
      <path d="M4 5h16v11H9l-5 4V5z" />
    </Icon>
  ),
  karte: (
    <Icon>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4h6v3H9zM9 12h6M9 16h4" />
    </Icon>
  ),
  review: (
    <Icon>
      <path d="M12 4l2.5 5.1 5.6.8-4 4 .9 5.6-5-2.7-5 2.7.9-5.6-4-4 5.6-.8L12 4z" />
    </Icon>
  ),
};

export const COMPOSE_LABELS: Record<ComposeKind, string> = {
  post: "投稿",
  message: "メッセージ",
  karte: "カルテ",
  review: "レビュー",
};
