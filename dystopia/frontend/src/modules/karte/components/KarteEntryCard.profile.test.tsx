// @vitest-environment happy-dom
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { KarteEntry } from "../types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { KarteEntryCard } = await import("./KarteEntryCard");
const { useAuthStore } = await import("@/stores/authStore");

const entry: KarteEntry = {
  id: "e-1",
  authorProfileId: "persona-a",
  targetProfileId: "target-1",
  isMine: true,
  authorUsername: "persona_a",
  authorAvatarUrl: "",
  targetUsername: "guest_hanako",
  targetAvatarUrl: "",
  rating: 4,
  body: "memo",
  flagged: false,
  status: "open",
  closedAt: null,
  events: [],
  latestEvent: null,
  eventCount: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
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
    expect(await textOf({ entry, mode: "my" })).toContain("@persona_a として記録");
  });

  it("says so when that profile no longer exists", async () => {
    expect(await textOf({ entry: { ...entry, authorUsername: "" }, mode: "my" })).toContain("削除したプロフィールで記録");
  });

  it("adds nothing for an entry written by the acting profile", async () => {
    useAuthStore.setState({ activeProfileId: "persona-a" });

    expect(await textOf({ entry, mode: "my" })).not.toContain("として記録");
  });

  it("adds nothing outside the own list", async () => {
    expect(await textOf({ entry, mode: "recent" })).not.toContain("として記録");
    expect(await textOf({ entry, mode: "target" })).not.toContain("として記録");
  });
});


it("opens the parent's detail callback with the entry id", async () => {
  const open = vi.fn(); const container = document.createElement("div"); const root = createRoot(container);
  await act(async () => root.render(createElement(KarteEntryCard, { entry, mode: "my", onOpen: open })));
  await act(async () => (container.querySelector("button") as HTMLButtonElement).click());
  expect(open).toHaveBeenCalledWith(entry.id);
  await act(async () => root.unmount());
});
