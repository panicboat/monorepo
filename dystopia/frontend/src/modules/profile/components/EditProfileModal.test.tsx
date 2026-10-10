// @vitest-environment happy-dom
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { EditProfileModal } = await import("./EditProfileModal");
const { emptyProfileView } = await import("@/modules/profile/lib/mappers");

describe("EditProfileModal", () => {
  it("offers each industry by its icon and its name to a cast", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(EditProfileModal, {
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
});
