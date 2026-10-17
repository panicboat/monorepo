// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { StarRatingInput } from "./star-rating-input";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function mount(value: number | null, onChange: (next: number | null) => void) {
  const container = document.createElement("div");
  await act(async () => {
    createRoot(container).render(createElement(StarRatingInput, { label: "満足度", value, onChange }));
  });
  return container;
}

const star = (container: HTMLElement, n: number) => container.querySelector(`button[aria-label="${n}つ星"]`) as HTMLButtonElement;

describe("StarRatingInput", () => {
  it("names the group with the given label and chooses the pressed star", async () => {
    const onChange = vi.fn();
    const container = await mount(null, onChange);

    expect(container.querySelector('[role="group"]')?.getAttribute("aria-label")).toBe("満足度");
    star(container, 4).click();

    expect(onChange).toHaveBeenCalledWith(4);
    expect(container.querySelectorAll("button")).toHaveLength(5);
  });

  it("clears the rating when the chosen star is pressed again and marks the chosen one", async () => {
    const onChange = vi.fn();
    const container = await mount(3, onChange);

    expect(star(container, 3).getAttribute("aria-pressed")).toBe("true");
    expect(star(container, 4).getAttribute("aria-pressed")).toBe("false");
    star(container, 3).click();

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
