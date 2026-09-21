import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PostComposer } from "./PostComposer";

describe("PostComposer", () => {
  it("exposes a file input for attaching images and videos", () => {
    const html = renderToStaticMarkup(<PostComposer onSubmit={async () => {}} />);

    expect(html).toContain('type="file"');
    expect(html).toContain('accept="image/*,video/*"');
    expect(html).toContain('multiple=""');
  });
});
