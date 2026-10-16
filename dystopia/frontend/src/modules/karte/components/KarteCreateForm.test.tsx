// @vitest-environment happy-dom
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../hooks/useKarteMutations", () => ({ useKarteMutations: () => ({ create: mocks.create, loading: false, error: null }) }));

const { KarteCreateForm } = await import("./KarteCreateForm");
const { emptyKarteEvent } = await import("./KarteEventForm");

const target = { profileId: "guest-1", username: "hanako", displayName: "はなこ", avatarUrl: "", isPrivate: false, role: "guest" as const };

function Harness({ onCreated }: { onCreated: () => void }) {
  const [event, setEvent] = useState(() => emptyKarteEvent());
  const [rating, setRating] = useState<number | null>(null);
  return createElement(KarteCreateForm, { target, event, onEventChange: setEvent, rating, onRatingChange: setRating, onCreated });
}

async function mount(onCreated: () => void) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(createElement(Harness, { onCreated }));
  });
  return container;
}

const submit = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "記録中のカルテを作成") as HTMLButtonElement;

beforeEach(() => {
  mocks.create.mockReset();
});

describe("KarteCreateForm", () => {
  it("creates an open karte for the guest with the chosen rating", async () => {
    mocks.create.mockResolvedValue({ id: "k-1" });
    const onCreated = vi.fn();
    const container = await mount(onCreated);

    await act(async () => (container.querySelector('button[aria-label="3つ星"]') as HTMLButtonElement).click());
    await act(async () => submit(container).click());

    expect(mocks.create).toHaveBeenCalledWith("guest-1", 3, expect.objectContaining({ stage: "reservation", outcome: "inquiry_only" }));
    expect(onCreated).toHaveBeenCalled();
  });

  it("keeps the form when creating fails", async () => {
    mocks.create.mockResolvedValue(null);
    const onCreated = vi.fn();
    const container = await mount(onCreated);

    await act(async () => submit(container).click());

    expect(mocks.create).toHaveBeenCalledWith("guest-1", null, expect.anything());
    expect(onCreated).not.toHaveBeenCalled();
    expect(container.textContent).toContain("記録中のカルテを作成");
  });
});
