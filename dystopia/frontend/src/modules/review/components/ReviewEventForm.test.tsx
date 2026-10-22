// @vitest-environment happy-dom
import type { ProfileSummaryView } from "@/modules/profile/types";
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { ReviewEventInput } from "../types";
import { ReviewEventForm, emptyReviewEvent, isReviewEventReady } from "./ReviewEventForm";

vi.mock("@/modules/profile/components/ActingProfileLabel", () => ({ ActingProfileLabel: () => createElement("span", null, "acting-profile") }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const base: ProfileSummaryView = { profileId: "p-1", displayName: "はなこ", username: "hanako", avatarUrl: "", isPrivate: false, role: "cast", industry: "" };
let cast: ProfileSummaryView | null = base;

function Harness({ initial, withRating, onSubmit }: { initial: ReviewEventInput; withRating: boolean; onSubmit: (event: ReviewEventInput, rating: number | null) => void }) {
  const [value, setValue] = useState(initial);
  const [rating, setRating] = useState<number | null>(null);
  return createElement(ReviewEventForm, {
    cast,
    value,
    onChange: setValue,
    rating: withRating ? { value: rating, onChange: setRating } : undefined,
    submitLabel: "保存",
    submitting: false,
    error: null,
    onSubmit: () => onSubmit(value, rating),
  });
}

async function mount(initial: ReviewEventInput, withRating = false, onSubmit = vi.fn()) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(createElement(Harness, { initial, withRating, onSubmit }));
  });
  return container;
}

const buttonNamed = (container: HTMLElement, name: string) =>
  Array.from(container.querySelectorAll("button")).find((b) => b.textContent === name) as HTMLButtonElement;

async function setValue(element: HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLSelectElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}

describe("ReviewEventForm", () => {
  it("asks for the gap from the photos and the service in the note and forbids illegal acts", async () => {
    const container = await mount(emptyReviewEvent());

    expect(container.querySelector("textarea")?.getAttribute("placeholder")).toBe(
      "店舗規約や法律に反する行為（裏引き・本番等）の記載は禁止です。写真とのギャップや接客の雰囲気などを記入してください"
    );
  });

  it("shows which profile the review is recorded as above the inputs", async () => {
    const container = await mount(emptyReviewEvent());

    const html = container.innerHTML;
    expect(html.indexOf("acting-profile")).toBeGreaterThanOrEqual(0);
    expect(html.indexOf("acting-profile")).toBeLessThan(html.indexOf("<fieldset"));
  });

  it("shows the cast and that the record is shared with every cast", async () => {
    const container = await mount(emptyReviewEvent("2026-10-16"));

    expect(container.textContent).toContain("はなこ");
    expect(container.textContent).toContain("@hanako · 全員に公開");
  });

  it("shows the handle for an empty display name and a lock mark only for a private profile", async () => {
    cast = { ...base, displayName: "", isPrivate: true };
    const privateHtml = (await mount(emptyReviewEvent("2026-10-16"))).innerHTML;
    cast = base;
    const publicHtml = (await mount(emptyReviewEvent("2026-10-16"))).innerHTML;

    expect(privateHtml).toContain("鍵付き");
    expect(privateHtml).toContain("@hanako");
    expect(publicHtml).not.toContain("鍵付き");
  });

  it("shows a deleted cast profile without a username or a name", async () => {
    cast = null;
    const container = await mount(emptyReviewEvent("2026-10-16"));
    cast = base;

    expect(container.textContent).toContain("削除したプロフィール");
    expect(container.textContent).toContain("全員に公開");
    expect(container.textContent).not.toContain("@");
  });

  it("resets the outcome and the tags when the stage changes", async () => {
    const container = await mount({ ...emptyReviewEvent("2026-10-16"), outcome: "cast_no_show", tags: ["late_reply"] });

    await act(async () => buttonNamed(container, "利用").click());

    expect(buttonNamed(container, "利用").getAttribute("aria-pressed")).toBe("true");
    expect((container.querySelector("select") as HTMLSelectElement).value).toBe("satisfied");
    expect(Array.from(container.querySelectorAll('button[aria-pressed="true"]')).map((b) => b.textContent)).toEqual(["利用"]);
  });

  it("toggles a tag", async () => {
    const container = await mount(emptyReviewEvent("2026-10-16"));

    await act(async () => buttonNamed(container, "返信が早い").click());
    expect(buttonNamed(container, "返信が早い").getAttribute("aria-pressed")).toBe("true");

    await act(async () => buttonNamed(container, "返信が早い").click());
    expect(buttonNamed(container, "返信が早い").getAttribute("aria-pressed")).toBe("false");
  });

  it("requires a note that is not only spaces for an outcome that needs one", async () => {
    const container = await mount({ ...emptyReviewEvent("2026-10-16"), outcome: "cast_no_show" });

    expect(container.textContent).toContain("補足（必須）");
    expect(buttonNamed(container, "保存").disabled).toBe(true);

    await setValue(container.querySelector("textarea")!, "   ");
    expect(buttonNamed(container, "保存").disabled).toBe(true);

    await setValue(container.querySelector("textarea")!, "連絡なし");
    expect(buttonNamed(container, "保存").disabled).toBe(false);
  });

  it("shows the given event's values for editing", async () => {
    const container = await mount({ stage: "aftercare", outcome: "trouble_occurred", tags: ["excessive_contact"], note: "何度も連絡", occurredOn: "2026-10-03" });

    expect(buttonNamed(container, "利用後").getAttribute("aria-pressed")).toBe("true");
    expect((container.querySelector("select") as HTMLSelectElement).value).toBe("trouble_occurred");
    expect(buttonNamed(container, "連絡が頻繁・執拗").getAttribute("aria-pressed")).toBe("true");
    expect((container.querySelector("textarea") as HTMLTextAreaElement).value).toBe("何度も連絡");
    expect((container.querySelector('input[type="date"]') as HTMLInputElement).value).toBe("2026-10-03");
  });

  it("asks for the rating only when given one, without a default, and submits it", async () => {
    const withoutRating = await mount(emptyReviewEvent("2026-10-16"));
    expect(withoutRating.querySelector('button[aria-label="1つ星"]')).toBeNull();

    const onSubmit = vi.fn();
    const container = await mount(emptyReviewEvent("2026-10-16"), true, onSubmit);
    expect(container.textContent).toContain("3.0 が標準。評価はクチコミ全体につき 1 つです");
    expect(container.querySelector('button[aria-pressed="true"][aria-label$="つ星"]')).toBeNull();

    await act(async () => (container.querySelector('button[aria-label="4つ星"]') as HTMLButtonElement).click());
    await act(async () => buttonNamed(container, "保存").click());

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ stage: "reservation", outcome: "inquiry_only" }), 4);
  });
});

describe("isReviewEventReady", () => {
  it("refuses a missing date and a note over 500 characters", () => {
    expect(isReviewEventReady({ ...emptyReviewEvent("2026-10-16"), occurredOn: "" })).toBe(false);
    expect(isReviewEventReady({ ...emptyReviewEvent("2026-10-16"), note: "あ".repeat(501) })).toBe(false);
    expect(isReviewEventReady(emptyReviewEvent("2026-10-16"))).toBe(true);
  });
});
