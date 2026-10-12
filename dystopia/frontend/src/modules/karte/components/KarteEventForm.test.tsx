// @vitest-environment happy-dom
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { KarteEventForm } from "./KarteEventForm";
import type { KarteEventInput } from "../types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReturnType<typeof createRoot>;
afterEach(async () => { await act(async () => root?.unmount()); });
describe("KarteEventForm", () => {
  it("keeps the note and date while resetting stage-specific choices", async () => {
    let value: KarteEventInput = { stage: "booking", outcome: "confirmed", tags: ["smooth_contact"], note: "予約時の補足", occurredOn: "2026-10-11" };
    function Probe() { const [event, setEvent] = useState(value); value = event; return createElement(KarteEventForm, { value: event, onChange: setEvent }); }
    const container = document.createElement("div"); root = createRoot(container);
    await act(async () => root.render(createElement(Probe)));
    await act(async () => (Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "接客") as HTMLButtonElement).click());
    expect(value).toEqual({ stage: "service", outcome: "", tags: [], note: "予約時の補足", occurredOn: "2026-10-11" });
    expect(container.textContent).toContain("支払いトラブルあり");
    expect(container.textContent).not.toContain("連絡が円滑");
  });
  it("counts Unicode code points and keeps over-limit input for correction", async () => {
    const container = document.createElement("div"); root = createRoot(container);
    const value: KarteEventInput = { stage: "service", outcome: "ended_early", tags: [], note: "😀".repeat(501), occurredOn: "2026-10-11" };
    await act(async () => root.render(createElement(KarteEventForm, { value, onChange: () => {}, errors: { note: "補足は500文字以内で入力してください" } })));
    expect((container.querySelector("textarea") as HTMLTextAreaElement).value).toBe(value.note);
    expect(container.textContent).toContain("501/500");
    expect(container.textContent).toContain("必須");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("500文字以内");
  });
});
