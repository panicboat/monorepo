import { describe, expect, it } from "vitest";
import { findActiveMention, insertMention } from "./mentions";

describe("findActiveMention", () => {
  it("finds the mention the caret is typing at the start or after a space", () => {
    expect(findActiveMention("@", 1)).toEqual({ start: 0, end: 1, query: "" });
    expect(findActiveMention("楽しかった @sa", 9)).toEqual({ start: 6, end: 9, query: "sa" });
  });

  it("takes a display name typed after the at sign as the query", () => {
    expect(findActiveMention("@さく", 3)).toEqual({ start: 0, end: 3, query: "さく" });
  });

  it("ignores an at sign glued to a word, as the server does", () => {
    expect(findActiveMention("mail@sa", 7)).toBeNull();
    expect(findActiveMention("@@sa", 4)).toBeNull();
  });

  it("ends the mention once a space is typed or the caret leaves it", () => {
    expect(findActiveMention("@sakura ", 8)).toBeNull();
    expect(findActiveMention("hi @sa", 2)).toBeNull();
  });
});

describe("insertMention", () => {
  it("replaces the typed mention with the username and a trailing space", () => {
    const text = "楽しかった @sa";
    expect(insertMention(text, findActiveMention(text, 9)!, "sakura_0412")).toEqual({ text: "楽しかった @sakura_0412 ", caret: 19 });
  });

  it("keeps the text after the caret without doubling a space", () => {
    const text = "@sa またね";
    expect(insertMention(text, findActiveMention(text, 3)!, "sakura")).toEqual({ text: "@sakura またね", caret: 8 });
  });
});
