import { describe, expect, it } from "vitest";
import { extractHashtags, hashtagSearchHref, splitTextByHashtags } from "./hashtags";

describe("extractHashtags", () => {
  it("takes each tag written in the text, in order, without the sign", () => {
    expect(extractHashtags("新作届いた #新作 #渋谷 today #new_look2")).toEqual(["新作", "渋谷", "new_look2"]);
  });

  it("accepts the full-width sign", () => {
    expect(extractHashtags("今日は ＃出勤")).toEqual(["出勤"]);
  });

  it("needs a break before the sign, in Japanese text too", () => {
    expect(extractHashtags("今日は#出勤")).toEqual([]);
    expect(extractHashtags("今日は。#出勤")).toEqual(["出勤"]);
  });

  it("keeps the first spelling of a tag repeated in another case", () => {
    expect(extractHashtags("#Spring and #spring")).toEqual(["Spring"]);
  });

  it("ends a tag at punctuation, a space or a line break", () => {
    expect(extractHashtags("#one, #two。#three\n#four!")).toEqual(["one", "two", "three", "four"]);
  });

  it("ignores a sign inside a word, a number-only run and a bare sign", () => {
    expect(extractHashtags("abc#def #123 # ## &#39;")).toEqual([]);
  });

  it("skips a run longer than fifty characters instead of cutting it", () => {
    expect(extractHashtags(`#${"a".repeat(51)} #${"b".repeat(50)}`)).toEqual(["b".repeat(50)]);
  });
});

describe("splitTextByHashtags", () => {
  it("splits out the tags that are saved on the post", () => {
    expect(splitTextByHashtags("新作 #新作 です", ["新作"])).toEqual([
      { type: "text", value: "新作 " },
      { type: "hashtag", tag: "新作", value: "#新作" },
      { type: "text", value: " です" },
    ]);
  });

  it("leaves a tag-looking word as text when the post does not carry that tag", () => {
    expect(splitTextByHashtags("see #unsaved", ["other"])).toEqual([{ type: "text", value: "see #unsaved" }]);
  });

  it("matches a saved tag whatever its case", () => {
    expect(splitTextByHashtags("#Spring", ["spring"])).toEqual([{ type: "hashtag", tag: "Spring", value: "#Spring" }]);
  });

  it("returns the text whole when there are no saved tags", () => {
    expect(splitTextByHashtags("plain #text", [])).toEqual([{ type: "text", value: "plain #text" }]);
  });
});

describe("hashtagSearchHref", () => {
  it("opens the search with the tag as the query", () => {
    expect(hashtagSearchHref("新作")).toBe("/search?q=%23%E6%96%B0%E4%BD%9C");
  });
});
