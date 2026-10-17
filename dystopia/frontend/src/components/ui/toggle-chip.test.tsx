// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ToggleChip } from "./toggle-chip";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("ToggleChip", () => {
  it("reports whether it is pressed and marks a pressed chip with the accent", () => {
    const pressed = renderToStaticMarkup(<ToggleChip pressed onClick={() => {}}>遅刻あり</ToggleChip>);
    const released = renderToStaticMarkup(<ToggleChip pressed={false} onClick={() => {}}>遅刻あり</ToggleChip>);

    expect(pressed).toContain('aria-pressed="true"');
    expect(pressed).toContain("border-accent");
    expect(released).toContain('aria-pressed="false"');
    expect(released).not.toContain("border-accent ");
  });

  it("is a plain button that calls onClick", async () => {
    const onClick = vi.fn();
    const container = document.createElement("div");
    await act(async () => {
      createRoot(container).render(createElement(ToggleChip, { pressed: false, onClick, children: "遅刻あり" }));
    });

    const button = container.querySelector("button") as HTMLButtonElement;
    expect(button.type).toBe("button");
    button.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
