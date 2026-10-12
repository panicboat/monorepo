import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "./button";

const classes = (html: string) => (/class="([^"]*)"/.exec(html)?.[1] ?? "").split(/\s+/);

describe("Button", () => {
  it("fills the primary button with the brand gradient and its glow", () => {
    const button = classes(renderToStaticMarkup(<Button>保存</Button>));

    expect(button).toEqual(expect.arrayContaining(["bg-gradient-brand", "shadow-brand-glow", "rounded-full"]));
  });

  it("outlines the secondary button in a tint of the accent with primary text", () => {
    const button = classes(renderToStaticMarkup(<Button variant="secondary">キャンセル</Button>));

    expect(button).toEqual(expect.arrayContaining(["border-accent/50", "bg-accent/10", "text-text-primary", "rounded-full"]));
    expect(button).not.toContain("text-accent");
  });
});
