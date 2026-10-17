// @vitest-environment happy-dom
import { act, createElement, useRef, type CSSProperties } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { useEnterAnimation } from "./useEnterAnimation";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Page({ route, fade }: { route: string; fade: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEnterAnimation(ref, route);
  return createElement("div", { ref, style: { "--duration-fade": fade } as CSSProperties });
}

let root: Root;
let container: HTMLElement;
let animate: MockInstance;

const show = (route: string, fade: string) => act(async () => root.render(createElement(Page, { route, fade })));

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  animate = vi.spyOn(Element.prototype, "animate").mockReturnValue({} as Animation);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  animate.mockRestore();
});

describe("useEnterAnimation", () => {
  it("stays still on the first render", async () => {
    await show("/", "200ms");

    expect(animate).not.toHaveBeenCalled();
  });

  it("fades the element in when the key changes, for the length of the fade token", async () => {
    await show("/", "200ms");
    await show("/search", "200ms");

    expect(animate.mock.calls).toEqual([
      [
        [
          { opacity: 0.55, transform: "translateY(5px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { duration: 200, easing: "ease" },
      ],
    ]);
  });

  it("stays still while the key is unchanged", async () => {
    await show("/", "200ms");
    await show("/", "200ms");

    expect(animate).not.toHaveBeenCalled();
  });

  it("stays still when the fade token is zero, as under reduced motion", async () => {
    await show("/", "0ms");
    await show("/search", "0ms");

    expect(animate).not.toHaveBeenCalled();
  });

  it("reads a fade token written in seconds", async () => {
    await show("/", "0.2s");
    await show("/search", "0.2s");

    expect(animate.mock.calls[0][1]).toEqual({ duration: 200, easing: "ease" });
  });
});
