// @vitest-environment happy-dom
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { RatingInput } from "./rating-input";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReturnType<typeof createRoot>;
afterEach(async () => { await act(async () => root?.unmount()); });

describe("RatingInput", () => {
  it("starts unrated, selects a star and explicitly clears it", async () => {
    const container = document.createElement("div"); root = createRoot(container);
    let selected: number | null = null;
    function Probe() { const [value, setValue] = useState<number | null>(null); selected = value; return createElement(RatingInput, { value, onChange: setValue, allowUnrated: true }); }
    await act(async () => root.render(createElement(Probe)));
    expect(container.querySelector('[aria-checked="true"]')).toBeNull();
    await act(async () => (container.querySelector('[aria-label="3つ星"]') as HTMLButtonElement).click());
    expect(selected).toBe(3);
    await act(async () => (Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "未評価にする") as HTMLButtonElement).click());
    expect(selected).toBeNull();
  });
  it("keeps required ratings selectable by keyboard without an unrated action", async () => {
    const container = document.createElement("div"); root = createRoot(container);
    let selected: number | null = 3;
    function Probe() { const [value, setValue] = useState<number | null>(3); selected = value; return createElement(RatingInput, { value, onChange: setValue, allowUnrated: false }); }
    await act(async () => root.render(createElement(Probe)));
    expect(container.textContent).not.toContain("未評価にする");
    await act(async () => (container.querySelector('[aria-label="3つ星"]') as HTMLButtonElement).dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
    expect(selected).toBe(4);
  });
});
