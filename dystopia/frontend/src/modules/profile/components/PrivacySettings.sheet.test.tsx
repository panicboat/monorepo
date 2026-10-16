// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { emptyProfileView } from "@/modules/profile/lib/mappers";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/modules/social/components/BlockedAccountsSheet", () => ({
  BlockedAccountsSheet: ({ open }: { open: boolean }) => <div>blocked-sheet:{String(open)}</div>,
}));

const { PrivacySettings } = await import("./PrivacySettings");

describe("PrivacySettings blocked accounts", () => {
  it("opens the blocked accounts in a sheet", async () => {
    const container = document.createElement("div");
    await act(async () => {
      createRoot(container).render(
        createElement(PrivacySettings, { profile: { ...emptyProfileView("p-1"), username: "yuna" }, save: async () => {} })
      );
    });
    expect(container.textContent).not.toContain("blocked-sheet:");

    await act(async () => {
      (Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "ブロックしたアカウント") as HTMLButtonElement).click();
    });

    expect(container.textContent).toContain("blocked-sheet:true");
  });
});
