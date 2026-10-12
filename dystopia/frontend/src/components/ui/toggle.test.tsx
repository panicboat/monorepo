import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Toggle } from "./toggle";

const track = (checked: boolean) =>
  (/<button[^>]*class="([^"]*)"/.exec(renderToStaticMarkup(<Toggle checked={checked} onCheckedChange={() => {}} />))?.[1] ?? "").split(/\s+/);

describe("Toggle", () => {
  it("colors the track with the accent while on", () => {
    expect(track(true)).toContain("bg-accent");
  });

  it("colors the track with the border color while off, so it stands out from the surface", () => {
    expect(track(false)).toContain("bg-border");
    expect(track(false)).not.toContain("bg-accent");
  });

  it("reports its state to assistive technology", () => {
    const html = renderToStaticMarkup(<Toggle checked onCheckedChange={() => {}} aria-label="通知" />);

    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="true"');
  });
});
