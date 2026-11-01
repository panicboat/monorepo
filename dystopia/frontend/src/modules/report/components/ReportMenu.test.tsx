// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/lib/auth", () => ({ authFetch: vi.fn() }));

const { ReportMenu } = await import("./ReportMenu");

let root: Root;

afterEach(async () => {
  await act(async () => root.unmount());
  document.body.innerHTML = "";
});

describe("ReportMenu", () => {
  it("opens the report dialog from its menu item", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(createElement(ReportMenu, { targetType: "post", targetId: "post-1" }));
    });

    await act(async () => {
      container.querySelector("button")?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    });
    const item = document.querySelector('[role="menuitem"]') as HTMLElement;
    expect(item.textContent).toBe("通報");
    await act(async () => {
      item.click();
    });

    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("通報する");
  });
});
