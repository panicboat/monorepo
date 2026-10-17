import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/modules/profile/components/ActingProfileLabel", () => ({ ActingProfileLabel: () => <span>acting-profile</span> }));

const { PostComposer } = await import("./PostComposer");

describe("PostComposer", () => {
  it("exposes a file input for attaching images and videos", () => {
    const html = renderToStaticMarkup(<PostComposer onSubmit={async () => {}} />);

    expect(html).toContain('type="file"');
    expect(html).toContain('accept="image/*,video/*"');
    expect(html).toContain('multiple=""');
  });

  it("shows which profile the post is written as above the input", () => {
    const html = renderToStaticMarkup(<PostComposer onSubmit={async () => {}} />);

    expect(html.indexOf("acting-profile")).toBeGreaterThanOrEqual(0);
    expect(html.indexOf("acting-profile")).toBeLessThan(html.indexOf("<textarea"));
  });
});
