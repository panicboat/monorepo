// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { ProfileSummaryView } from "@/modules/profile/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../hooks/useGuestKarte", () => ({
  useGuestKarte: () => ({
    kartes: [],
    reliability: { averageRating: 4, raterCount: 1, karteCount: 2 },
    hasMore: false,
    loading: false,
    loadMore: vi.fn(),
  }),
}));
vi.mock("./KarteList", () => ({
  KarteList: ({ variant, empty }: { variant: string; empty: string }) => <div>list:{variant}:{empty}</div>,
}));
vi.mock("@/components/compose/ComposeToSheet", () => ({
  ComposeToSheet: ({ kind, open, initialTarget }: { kind: string; open: boolean; initialTarget?: ProfileSummaryView }) => (
    <div>compose:{kind}:{String(open)}:{initialTarget?.profileId}</div>
  ),
}));

const { GuestKarteTab } = await import("./GuestKarteTab");

const guest: ProfileSummaryView = { profileId: "guest-1", username: "hanako", displayName: "はなこ", avatarUrl: "", isPrivate: false, role: "guest" };

describe("GuestKarteTab", () => {
  it("shows the reliability above the guest's kartes and writes a karte for this guest", async () => {
    const container = document.createElement("div");
    await act(async () => {
      createRoot(container).render(createElement(GuestKarteTab, { guest }));
    });

    expect(container.textContent).toContain("4.0");
    expect(container.textContent).toContain("1人が評価 · 2件の評価済みカルテ");
    expect(container.textContent).toContain("list:guest:カルテはまだありません");
    expect(container.textContent).not.toContain("compose:");

    await act(async () => {
      (Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "このゲストのカルテを書く") as HTMLButtonElement).click();
    });

    expect(container.textContent).toContain("compose:karte:true:guest-1");
  });
});
