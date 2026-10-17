import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("../hooks/useCreateReview", () => ({
  useCreateReview: () => ({ create: vi.fn(), loading: false, error: null }),
}));

vi.mock("@/modules/profile/components/ActingProfileLabel", () => ({ ActingProfileLabel: () => <span>acting-profile</span> }));

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

  it("shows which profile the review is written as above the input", () => {
    const html = renderToStaticMarkup(<ReviewComposer targetProfileId="target-1" />);

    expect(html.indexOf("acting-profile")).toBeGreaterThanOrEqual(0);
    expect(html.indexOf("acting-profile")).toBeLessThan(html.indexOf("<textarea"));
  });
});
