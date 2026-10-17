import { describe, expect, it } from "vitest";
import type { Review } from "../types";
import { uniqueReviews } from "./uniqueReviews";

const review = (id: string, rating: number | null = null) => ({ id, rating }) as Review;

describe("uniqueReviews", () => {
  it("keeps the first of each id in order", () => {
    const first = review("a", 4);

    expect(uniqueReviews([first, review("b"), review("a", 1), review("c")])).toEqual([first, review("b"), review("c")]);
  });
});
