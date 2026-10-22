// The lookbehind matches the server's mention pattern; the query allows any non-space text because a display name can be typed after "@".
const ACTIVE_MENTION = /(?<![A-Za-z0-9_@])@([^\s@]{0,30})$/u;

export interface ActiveMention {
  start: number;
  end: number;
  query: string;
}

export function findActiveMention(text: string, caret: number): ActiveMention | null {
  const match = text.slice(0, caret).match(ACTIVE_MENTION);
  if (!match || match.index === undefined) return null;
  return { start: match.index, end: caret, query: match[1] };
}

export function insertMention(text: string, mention: ActiveMention, username: string): { text: string; caret: number } {
  const inserted = `@${username} `;
  const rest = text.slice(mention.end);
  return {
    text: text.slice(0, mention.start) + inserted + (rest.startsWith(" ") ? rest.slice(1) : rest),
    caret: mention.start + inserted.length,
  };
}
