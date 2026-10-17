// @vitest-environment happy-dom
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { KarteEventInput } from "../types";
import { KarteEventFields, emptyKarteEvent, isKarteEventReady } from "./KarteEventFields";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const latest: { value: KarteEventInput | null } = { value: null };

function Harness({ initial }: { initial: KarteEventInput }) {
  const [value, setValue] = useState(initial);
  latest.value = value;
  return createElement(KarteEventFields, { value, onChange: setValue });
}

let root: Root;
let container: HTMLElement;

async function render(initial: KarteEventInput) {
  await act(async () => root.render(createElement(Harness, { initial })));
}

async function choose(select: HTMLSelectElement, value: string) {
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("KarteEventFields", () => {
  it("starts on the reservation stage with its first outcome and the given day", () => {
    expect(emptyKarteEvent("2026-10-16")).toEqual({ stage: "reservation", outcome: "inquiry_only", tags: [], note: "", occurredOn: "2026-10-16" });
  });

  it("moves to the first outcome of a new stage and drops the old stage's tags", async () => {
    await render({ ...emptyKarteEvent("2026-10-16"), tags: ["smooth_contact"] });
    const [stage] = Array.from(container.querySelectorAll("select"));

    await choose(stage, "service");

    expect(latest.value).toMatchObject({ stage: "service", outcome: "completed", tags: [] });
    expect(container.textContent).toContain("遅刻あり");
    expect(container.textContent).not.toContain("連絡が円滑");
  });

  it("marks the note as required for a serious outcome", async () => {
    await render({ ...emptyKarteEvent("2026-10-16"), outcome: "no_show" });

    expect(container.textContent).toContain("補足（必須）");
  });

  it("toggles a tag", async () => {
    await render(emptyKarteEvent("2026-10-16"));
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;

    await act(async () => checkbox.click());

    expect(latest.value?.tags).toEqual(["smooth_contact"]);
  });
});

describe("isKarteEventReady", () => {
  it("needs a day and a note for a serious outcome", () => {
    const base = emptyKarteEvent("2026-10-16");

    expect(isKarteEventReady(base)).toBe(true);
    expect(isKarteEventReady({ ...base, occurredOn: "" })).toBe(false);
    expect(isKarteEventReady({ ...base, outcome: "no_show", note: "  " })).toBe(false);
    expect(isKarteEventReady({ ...base, outcome: "no_show", note: "連絡なし" })).toBe(true);
  });
});
