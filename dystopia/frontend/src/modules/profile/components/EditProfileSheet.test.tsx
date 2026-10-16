// @vitest-environment happy-dom
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next/navigation", () => ({ usePathname: () => "/u/yuna" }));

const { EditProfileSheet } = await import("./EditProfileSheet");
const { emptyProfileView } = await import("@/modules/profile/lib/mappers");

describe("EditProfileSheet", () => {
  it("offers each industry by its icon and its name to a cast", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(EditProfileSheet, {
          open: true,
          onOpenChange: () => {},
          profile: emptyProfileView("p1"),
          isCast: true,
          onSave: async () => {},
          onSaveMedia: async () => {},
        })
      );
    });
    const options = Array.from(document.querySelectorAll("#industry option"), (option) => option.textContent);

    expect(options).toContain("🚗 デリヘル");
    expect(options).toContain("🛁 ソープ");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("opens as a sheet that says which profile is being edited", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      createRoot(container).render(
        createElement(EditProfileSheet, {
          open: true,
          onOpenChange: () => {},
          profile: { ...emptyProfileView("p1"), displayName: "ゆな", username: "yuna" },
          isCast: true,
          onSave: async () => {},
          onSaveMedia: async () => {},
        })
      );
    });

    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("プロフィールを編集");
    expect(document.body.textContent).toContain("ゆなとして編集中");
    expect(document.body.textContent).toContain("@yuna");
  });
});
