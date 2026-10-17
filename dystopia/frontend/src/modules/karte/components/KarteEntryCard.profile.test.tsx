// @vitest-environment happy-dom
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../hooks/useKarteMutations", () => ({
  useKarteMutations: () => ({ updateRating: vi.fn(), close: vi.fn(), reopen: vi.fn(), addEvent: vi.fn(), remove: vi.fn(), loading: false, error: null }),
}));

const { KarteEntryCard } = await import("./KarteEntryCard");
const { useAuthStore } = await import("@/stores/authStore");

const entry: import("../types").Karte = {
  id: "k-1",
  authorProfileId: "persona-a",
  authorUsername: "persona_a",
  authorAvatarUrl: "",
  targetProfileId: "target-1",
  targetUsername: "guest_hanako",
  targetAvatarUrl: "",
  isMine: true,
  rating: 4,
  status: "open",
  events: [{ id: "e-1", stage: "service", outcome: "completed", tags: [], note: "", occurredOn: "2026-10-01", createdAt: "", updatedAt: "" }],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  closedAt: null,
};

async function textOf(props: Parameters<typeof KarteEntryCard>[0]) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(KarteEntryCard, props));
  });
  const text = container.textContent ?? "";
  await act(async () => {
    root.unmount();
  });
  container.remove();
  return text;
}

describe("KarteEntryCard written by another profile of the account", () => {
  beforeEach(() => {
    useAuthStore.setState({ activeProfileId: "persona-b" });
  });

  it("names the profile that wrote the entry in the own list", async () => {
    expect(await textOf({ karte: entry, mode: "my" })).toContain("@persona_a として記録");
  });

  it("says so when that profile no longer exists", async () => {
    expect(await textOf({ karte: { ...entry, authorUsername: "" }, mode: "my" })).toContain("削除したプロフィールで記録");
  });

  it("adds nothing for an entry written by the acting profile", async () => {
    useAuthStore.setState({ activeProfileId: "persona-a" });

    expect(await textOf({ karte: entry, mode: "my" })).not.toContain("として記録");
  });

  it("adds nothing outside the own list", async () => {
    expect(await textOf({ karte: entry, mode: "recent" })).not.toContain("として記録");
    expect(await textOf({ karte: entry, mode: "target" })).not.toContain("として記録");
  });
});
