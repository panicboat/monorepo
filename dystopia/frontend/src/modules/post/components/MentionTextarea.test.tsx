// @vitest-environment happy-dom
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProfileSummaryView } from "@/modules/profile/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const profile = (username: string, displayName: string): ProfileSummaryView => ({
  profileId: username,
  username,
  displayName,
  avatarUrl: "",
  isPrivate: false,
  role: "cast",
  industry: "",
});

const mocks = vi.hoisted(() => ({
  following: [] as ProfileSummaryView[],
  queries: [] as (string | null)[],
}));

vi.mock("@/modules/social/hooks", () => ({
  useFollowingSuggestions: (query: string | null) => {
    mocks.queries.push(query);
    return { profiles: query === null ? [] : mocks.following, loading: false };
  },
}));

const { MentionTextarea } = await import("./MentionTextarea");

let container: HTMLDivElement;
let latest = "";

function Harness() {
  const [value, setValue] = useState("");
  latest = value;
  return createElement(MentionTextarea, { value, onValueChange: setValue, "aria-label": "投稿内容" });
}

async function mount() {
  container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(Harness));
  });
  return async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  };
}

const textarea = () => container.querySelector("textarea") as HTMLTextAreaElement;
const options = () => Array.from(container.querySelectorAll("[role=option]"), (li) => li.textContent?.match(/@(\w+)$/)?.[1]);

async function type(value: string) {
  const el = textarea();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(el, value);
    el.setSelectionRange(value.length, value.length);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function press(key: string) {
  await act(async () => {
    textarea().dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
}

beforeEach(() => {
  mocks.following = [profile("sakura_0412", "さくら"), profile("satomi_cast", "Satomi")];
  mocks.queries.length = 0;
});

describe("MentionTextarea", () => {
  it("suggests followed profiles for the text typed after an at sign", async () => {
    const unmount = await mount();

    await type("楽しかった @さく");

    expect(mocks.queries.at(-1)).toBe("さく");
    expect(options()).toEqual(["sakura_0412", "satomi_cast"]);
    expect(textarea().getAttribute("aria-expanded")).toBe("true");
    await unmount();
  });

  it("suggests nothing for an at sign glued to a word", async () => {
    const unmount = await mount();

    await type("mail@sa");

    expect(mocks.queries.at(-1)).toBeNull();
    expect(options()).toEqual([]);
    await unmount();
  });

  it("replaces the typed mention with the clicked profile's username", async () => {
    const unmount = await mount();
    await type("楽しかった @sa");

    await act(async () => {
      (container.querySelectorAll("[role=option]")[1] as HTMLElement).click();
    });

    expect(latest).toBe("楽しかった @satomi_cast ");
    expect(textarea().selectionStart).toBe(latest.length);
    expect(options()).toEqual([]);
    await unmount();
  });

  it("moves through the suggestions with the arrow keys and picks one with enter", async () => {
    const unmount = await mount();
    await type("@s");

    await press("ArrowDown");
    expect(container.querySelectorAll("[role=option]")[1].getAttribute("aria-selected")).toBe("true");
    await press("Enter");

    expect(latest).toBe("@satomi_cast ");
    await unmount();
  });

  it("closes the suggestions with escape until a new mention starts", async () => {
    const unmount = await mount();
    await type("@s");

    await press("Escape");
    expect(options()).toEqual([]);
    await type("@sa");
    expect(options()).toEqual([]);

    await type("@sa @");
    expect(options()).toEqual(["sakura_0412", "satomi_cast"]);
    await unmount();
  });

  it("closes the suggestions once a space is typed", async () => {
    const unmount = await mount();
    await type("@sa");

    await type("@sa ");

    expect(options()).toEqual([]);
    await unmount();
  });
});
