import { describe, expect, it } from "vitest";
import { INDUSTRIES, industryIcon } from "./constants";

describe("INDUSTRIES", () => {
  it("lists the industries a cast can choose, each with the icon it goes by", () => {
    expect(INDUSTRIES.map(({ name, icon }) => `${icon} ${name}`)).toEqual([
      "🛁 ソープ",
      "🚗 デリヘル",
      "🏩 ホテヘル",
      "📦 箱ヘル",
      "🍜 メンズエステ",
      "🎈 風俗エステ",
      "📍 ピンサロ",
      "🥂 キャバクラ",
      "🍸 ガールズバー",
      "🅿️ パパ活",
      "📸 個撮",
    ]);
  });

  it("gives every industry its own icon", () => {
    const icons = INDUSTRIES.map((industry) => industry.icon);

    expect(new Set(icons).size).toBe(INDUSTRIES.length);
  });
});

describe("industryIcon", () => {
  it("returns the icon of a listed industry", () => {
    expect(industryIcon("デリヘル")).toBe("🚗");
    expect(industryIcon("ピンサロ")).toBe("📍");
  });

  it("returns nothing for an unlisted or unset industry", () => {
    expect(industryIcon("個人")).toBeUndefined();
    expect(industryIcon("")).toBeUndefined();
  });
});
