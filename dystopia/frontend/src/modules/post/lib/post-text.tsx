"use client";

import { Fragment } from "react";
import { useRouter } from "next/navigation";
import type { MentionView } from "./post-view";
import { hashtagSearchHref, splitTextByHashtags } from "./hashtags";

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

export interface PostTextProps {
  content: string;
  mentions: MentionView[];
  hashtags?: string[];
  className?: string;
}

// The text sits inside the link to the post, so these are spans that navigate: a nested anchor would be invalid.
function InlineLink({ href, children }: { href: string; children: string }) {
  const router = useRouter();
  const navigate = (e: { preventDefault: () => void; stopPropagation: () => void }) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(href);
  };

  return (
    <span
      role="link"
      tabIndex={0}
      className="cursor-pointer text-accent hover:underline"
      onClick={navigate}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        navigate(e);
      }}
    >
      {children}
    </span>
  );
}

export function PostText({ content, mentions, hashtags = [], className }: PostTextProps) {
  const parts = splitContentByMentions(content, mentions);

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.type === "mention" ? (
          <InlineLink key={i} href={`/u/${encodeURIComponent(part.username)}`}>
            {part.value}
          </InlineLink>
        ) : (
          <Fragment key={i}>
            {splitTextByHashtags(part.value, hashtags).map((piece, j) =>
              piece.type === "hashtag" ? (
                <InlineLink key={j} href={hashtagSearchHref(piece.tag)}>
                  {piece.value}
                </InlineLink>
              ) : (
                <Fragment key={j}>{piece.value}</Fragment>
              ),
            )}
          </Fragment>
        ),
      )}
    </span>
  );
}
