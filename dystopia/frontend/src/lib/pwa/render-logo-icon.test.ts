import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const logo = readFileSync(join(process.cwd(), "public/logo.svg"), "utf8");

describe("logo", () => {
  it("is drawn from shapes alone, because the server that renders the icons has no font for text", () => {
    expect(logo).not.toMatch(/<text[\s>]/);
    expect(logo).not.toContain("font-family");
  });

  it("leaves the background to the icon, so a shrunk logo shows no frame around it", () => {
    expect(logo).not.toMatch(/<rect[^>]*width="300"[^>]*height="300"/);
  });
});
