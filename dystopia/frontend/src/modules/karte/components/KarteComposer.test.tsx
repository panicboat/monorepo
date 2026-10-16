// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { todayInJapan } from "../lib/dates";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../hooks/useKarteMutations", () => ({
  useKarteMutations: () => ({ create: mocks.create, loading: false, error: null }),
}));

const { KarteComposer } = await import("./KarteComposer");

let root: Root;
let container: HTMLElement;

beforeEach(async () => {
  mocks.create.mockReset().mockResolvedValue({ id: "k-1" });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("KarteComposer", () => {
  it("leaves the rating unselected and creates the karte with the first event", async () => {
    const onCreated = vi.fn();
    await act(async () => root.render(createElement(KarteComposer, { targetProfileId: "guest-1", onCreated })));
    const rating = Array.from(container.querySelectorAll("select")).at(-1) as HTMLSelectElement;
    expect(rating.value).toBe("");

    await act(async () => {
      container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(mocks.create).toHaveBeenCalledWith("guest-1", null, {
      stage: "reservation",
      outcome: "inquiry_only",
      tags: [],
      note: "",
      occurredOn: todayInJapan(),
    });
    expect(onCreated).toHaveBeenCalledTimes(1);
  });

  it("keeps the form when the server refuses the karte", async () => {
    mocks.create.mockResolvedValue(null);
    const onCreated = vi.fn();
    await act(async () => root.render(createElement(KarteComposer, { targetProfileId: "guest-1", onCreated })));

    await act(async () => {
      container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(onCreated).not.toHaveBeenCalled();
  });
});
