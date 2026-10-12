import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const layout = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");

function declarations(source: string, opener: string): Record<string, string> {
  const start = source.indexOf(opener);
  if (start < 0) throw new Error(`${opener} is missing`);
  const body = source.slice(start + opener.length, source.indexOf("}", start));
  return Object.fromEntries(
    Array.from(body.matchAll(/(--[\w-]+):\s*([^;]+);/g), (match) => [match[1], match[2].replace(/\s+/g, " ").trim()])
  );
}

const dark = declarations(css, ":root {");
const light = declarations(css, '[data-theme="light"] {');
const reducedMotion = declarations(css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)")), ":root {");
const theme = declarations(css, "@theme inline {");

describe("design tokens", () => {
  it("paints the dark theme with the mock's surfaces, rules and text", () => {
    expect(dark).toMatchObject({
      "--color-backdrop": "#090a0e",
      "--color-bg": "#13151b",
      "--color-bg-elevated": "#181a21",
      "--color-surface": "#1b1e27",
      "--color-bg-secondary": "#20232b",
      "--color-input-bg": "#2b2c30",
      "--color-border": "#303744",
      "--color-divider": "#28313e",
      "--color-text-primary": "#f6f4f8",
      "--color-text-secondary": "#a4b1c5",
      "--color-text-muted": "#8390a5",
      "--color-rating": "#eab270",
    });
  });

  it("draws the brand from the mock's violet and pink", () => {
    expect(dark).toMatchObject({
      "--color-brand-primary": "#b54bf1",
      "--color-brand-secondary": "#e344ae",
      "--color-brand-gradient-from": "#a345ed",
      "--color-brand-gradient-to": "#e448a8",
      "--color-accent": "var(--color-brand-primary)",
      "--gradient-brand-2": "linear-gradient(110deg, var(--color-brand-gradient-from), var(--color-brand-gradient-to))",
      "--shadow-brand-glow": "0 7px 21px rgb(168 44 146 / 0.27)",
    });
  });

  it("keeps the light theme's own surfaces and gives it the added tokens", () => {
    expect(light).toMatchObject({
      "--color-bg": "#ffffff",
      "--color-backdrop": "var(--color-neutral-50)",
      "--color-bg-elevated": "#ffffff",
      "--color-rating": "var(--color-warning)",
    });
    expect(light).not.toHaveProperty("--color-brand-primary");
  });

  it("exposes the added colors as utilities and keeps form controls at a 12px corner", () => {
    expect(theme).toMatchObject({
      "--color-backdrop": "var(--color-backdrop)",
      "--color-bg-elevated": "var(--color-bg-elevated)",
      "--color-rating": "var(--color-rating)",
      "--radius-md": "0.75rem",
    });
  });

  it("times motion from three durations and removes them for reduced motion", () => {
    expect(dark).toMatchObject({
      "--duration-slide": "330ms",
      "--duration-fade": "200ms",
      "--duration-quick": "170ms",
      "--ease-emphasized": "cubic-bezier(0.22, 1, 0.36, 1)",
    });
    expect(reducedMotion).toEqual({
      "--duration-slide": "0ms",
      "--duration-fade": "0ms",
      "--duration-quick": "0ms",
    });
  });

  it("carries no token without a consumer", () => {
    expect(css).not.toMatch(/brand-tertiary|gradient-brand-3|neutral-(600|700|800|950)/);
  });

  it("colors the browser chrome like the dark app surface", () => {
    expect(layout).toContain(`{ media: "(prefers-color-scheme: dark)", color: "${dark["--color-bg"]}" }`);
  });
});
