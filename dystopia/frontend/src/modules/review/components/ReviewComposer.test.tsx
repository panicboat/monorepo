import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("../hooks/useCreateReview", () => ({
  useCreateReview: () => ({ create: vi.fn(), loading: false, error: null }),
}));

const { ReviewComposer } = await import("./ReviewComposer");

describe("ReviewComposer", () => {
  it("offers whole ratings from one to five", () => {
    const html = renderToStaticMarkup(<ReviewComposer targetProfileId="target-1" />);
    const values = Array.from(html.matchAll(/<option value="([^"]+)"/g), (match) => match[1]);

    expect(values).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("labels each rating with filled and empty stars", () => {
    const html = renderToStaticMarkup(<ReviewComposer targetProfileId="target-1" />);

    expect(html).toContain("★★★★☆ (4)");
  });
});
