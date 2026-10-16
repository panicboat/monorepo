import { describe, expect, it } from "vitest";
import type { Karte } from "../types";
import { uniqueKartes } from "./uniqueKartes";

const karte = (id: string, rating: number | null = null) => ({ id, rating }) as Karte;

describe("uniqueKartes", () => {
  it("keeps the first of each id in order", () => {
    const first = karte("a", 4);

    expect(uniqueKartes([first, karte("b"), karte("a", 1), karte("c")])).toEqual([first, karte("b"), karte("c")]);
  });
});
