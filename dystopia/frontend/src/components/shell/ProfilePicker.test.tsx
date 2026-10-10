// @vitest-environment happy-dom
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { ProfilePicker } = await import("./ProfilePicker");

const profiles = [
  { id: "p1", displayName: "Yuna", username: "yuna", avatarUrl: "" },
  { id: "p2", displayName: "Yuna Two", username: "yuna_two", avatarUrl: "" },
];

describe("ProfilePicker", () => {
  it("lists every profile it is given and reports the chosen one", async () => {
    const onSelect = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(ProfilePicker, { profiles, onSelect }));
    });
    const buttons = Array.from(container.querySelectorAll("button"));

    expect(buttons).toHaveLength(profiles.length);
    expect(container.textContent).toContain("@yuna");
    expect(container.textContent).toContain("@yuna_two");

    await act(async () => {
      buttons.find((button) => button.textContent?.includes("@yuna_two"))?.click();
    });
    expect(onSelect.mock.calls).toEqual([["p2"]]);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
