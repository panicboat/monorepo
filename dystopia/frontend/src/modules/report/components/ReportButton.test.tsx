// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/lib/auth", () => ({ authFetch: vi.fn() }));

const { ReportButton } = await import("./ReportButton");

let root: Root;

afterEach(async () => {
  await act(async () => root.unmount());
  document.body.innerHTML = "";
});

describe("ReportButton", () => {
  it("opens the report dialog", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(createElement(ReportButton, { targetType: "comment", targetId: "comment-1", label: "通報" }));
    });

    await act(async () => {
      container.querySelector("button")?.click();
    });

    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("通報する");
  });
});
