const WORD = "\\p{L}\\p{M}\\p{N}_";
const MAX_TAG_LENGTH = 50;
// A sign glued to the end of a word or a character reference (`&#39;`) is not a tag, and a run longer than the limit is skipped whole.
const HASHTAG = new RegExp(`(?<![${WORD}#＃&])[#＃]([${WORD}]{1,${MAX_TAG_LENGTH}})(?![${WORD}])`, "gu");
const DIGITS_ONLY = /^\p{N}+$/u;

export type HashtagPart = { type: "text"; value: string } | { type: "hashtag"; tag: string; value: string };

function matchesOf(text: string): { index: number; value: string; tag: string }[] {
  return Array.from(text.matchAll(HASHTAG), (match) => ({ index: match.index, value: match[0], tag: match[1] })).filter(
    ({ tag }) => !DIGITS_ONLY.test(tag)
  );
}

export function extractHashtags(content: string): string[] {
  const seen = new Set<string>();
  return matchesOf(content)
    .map(({ tag }) => tag)
    .filter((tag) => {
      const key = tag.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function splitTextByHashtags(text: string, hashtags: string[]): HashtagPart[] {
  const saved = new Set(hashtags.map((tag) => tag.toLowerCase()));
  const parts: HashtagPart[] = [];
  let cursor = 0;

  for (const { index, value, tag } of matchesOf(text)) {
    if (!saved.has(tag.toLowerCase())) continue;
    if (index > cursor) parts.push({ type: "text", value: text.slice(cursor, index) });
    parts.push({ type: "hashtag", tag, value });
    cursor = index + value.length;
  }

  if (cursor < text.length) parts.push({ type: "text", value: text.slice(cursor) });
  return parts;
}

export function hashtagSearchHref(tag: string): string {
  return `/search?q=${encodeURIComponent(`#${tag}`)}`;
}
