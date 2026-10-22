"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { ProfileName } from "@/components/ui/profile-name";
import { Textarea, type TextareaProps } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useFollowingSuggestions } from "@/modules/social/hooks";
import type { ProfileSummaryView } from "@/modules/profile/types";
import { findActiveMention, insertMention } from "@/modules/post/lib/mentions";

export interface MentionTextareaProps extends Omit<TextareaProps, "value" | "onChange"> {
  value: string;
  onValueChange: (value: string) => void;
}

function caretOf(el: HTMLTextAreaElement): number | null {
  return el.selectionStart === el.selectionEnd ? el.selectionStart : null;
}

export function MentionTextarea({ value, onValueChange, onKeyDown, onSelect, onBlur, ...props }: MentionTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const listId = useId();
  const [caret, setCaret] = useState<number | null>(null);
  const [dismissedStart, setDismissedStart] = useState<number | null>(null);
  const [highlighted, setHighlighted] = useState(0);

  const mention = caret === null ? null : findActiveMention(value, caret);
  const open = mention !== null && mention.start !== dismissedStart;
  const { profiles: suggested } = useFollowingSuggestions(open ? mention.query : null);
  const profiles = open ? suggested.filter((p) => p.username) : [];
  const showList = profiles.length > 0;
  const active = Math.min(highlighted, profiles.length - 1);

  useEffect(() => {
    if (pendingCaret.current === null || !ref.current) return;
    ref.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
  }, [value]);

  const pick = (profile: ProfileSummaryView) => {
    if (!mention) return;
    const next = insertMention(value, mention, profile.username);
    pendingCaret.current = next.caret;
    setCaret(next.caret);
    onValueChange(next.text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showList && mention && !e.nativeEvent.isComposing) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        setHighlighted((active + step + profiles.length) % profiles.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pick(profiles[active]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setDismissedStart(mention.start);
        return;
      }
    }
    onKeyDown?.(e);
  };

  return (
    <div className="relative">
      <Textarea
        {...props}
        ref={ref}
        value={value}
        onChange={(e) => {
          const nextCaret = caretOf(e.target);
          setCaret(nextCaret);
          setHighlighted(0);
          if (nextCaret === null || !findActiveMention(e.target.value, nextCaret)) setDismissedStart(null);
          onValueChange(e.target.value);
        }}
        onSelect={(e) => {
          setCaret(caretOf(e.currentTarget));
          onSelect?.(e);
        }}
        onBlur={(e) => {
          setCaret(null);
          onBlur?.(e);
        }}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={showList ? listId : undefined}
        aria-activedescendant={showList ? `${listId}-${active}` : undefined}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="メンションする相手"
          className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-border bg-bg-elevated shadow-lg"
        >
          {profiles.map((profile, index) => (
            <li
              key={profile.profileId}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(profile)}
              className={cn(
                "flex cursor-pointer items-center gap-3 border-b border-divider px-3 py-2 last:border-b-0 hover:bg-bg-secondary",
                index === active && "bg-bg-secondary"
              )}
            >
              <Avatar src={profile.avatarUrl || undefined} fallback={(profile.displayName || profile.username).slice(0, 1) || "?"} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 text-sm"><ProfileName profile={profile} /></span>
                <span className="block truncate text-xs text-text-secondary">@{profile.username}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
