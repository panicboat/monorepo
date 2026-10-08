"use client";

import { Fragment } from "react";
import { useRouter } from "next/navigation";
import type { MentionView } from "./post-view";

export type ContentPart =
  | { type: "text"; value: string }
  | { type: "mention"; profileId: string; username: string; value: string };

export function splitContentByMentions(
  content: string,
  mentions: MentionView[],
): ContentPart[] {
  const chars = Array.from(content);
  const resolved = mentions
    .filter((m) => m.username.length > 0)
    .slice()
    .sort((a, b) => a.position - b.position);

  const parts: ContentPart[] = [];
  let cursor = 0;

  for (const mention of resolved) {
    if (mention.position < cursor) continue;
    if (mention.position > cursor) {
      parts.push({
        type: "text",
        value: chars.slice(cursor, mention.position).join(""),
      });
    }
    const value = chars
      .slice(mention.position, mention.position + mention.length)
      .join("");
    parts.push({
      type: "mention",
      profileId: mention.profileId,
      username: mention.username,
      value,
    });
    cursor = mention.position + mention.length;
  }

  if (cursor < chars.length) {
    parts.push({ type: "text", value: chars.slice(cursor).join("") });
  }
  if (parts.length === 0) {
    parts.push({ type: "text", value: content });
  }

  return parts;
}

export interface MentionTextProps {
  content: string;
  mentions: MentionView[];
  className?: string;
}

export function MentionText({
  content,
  mentions,
  className,
}: MentionTextProps) {
  const router = useRouter();
  const parts = splitContentByMentions(content, mentions);
  const navigateToMention = (username: string) => {
    router.push(`/u/${encodeURIComponent(username)}`);
  };

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.type === "mention" ? (
          <span
            key={i}
            role="link"
            tabIndex={0}
            className="cursor-pointer text-accent hover:underline"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              navigateToMention(part.username);
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== " ") return;
              e.preventDefault();
              e.stopPropagation();
              navigateToMention(part.username);
            }}
          >
            {part.value}
          </span>
        ) : (
          <Fragment key={i}>{part.value}</Fragment>
        ),
      )}
    </span>
  );
}
