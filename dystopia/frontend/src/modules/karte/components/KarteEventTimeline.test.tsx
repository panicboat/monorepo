import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { KarteEventTimeline } from "./KarteEventTimeline";
import type { KarteEvent } from "../types";

const event = (id: string, stage: KarteEvent["stage"], occurredOn: string): KarteEvent => ({ id, entryId: "entry", stage, outcome: stage === "booking" ? "confirmed" : "completed", tags: [], note: id, occurredOn, createdAt: "2026-10-12T00:00:00Z", updatedAt: "2026-10-12T00:00:00Z" });
describe("KarteEventTimeline", () => {
  it("groups stages and orders backdated events by date before recording time", () => {
    const html = renderToStaticMarkup(<KarteEventTimeline events={[event("service-later", "service", "2026-10-12"), event("booking", "booking", "2026-10-11"), event("service-earlier", "service", "2026-10-10")]} readOnly />);
    expect(html.indexOf(">booking<")).toBeLessThan(html.indexOf(">service-earlier<"));
    expect(html.indexOf(">service-earlier<")).toBeLessThan(html.indexOf(">service-later<"));
    expect(html).not.toContain("button");
  });
  it("disables deleting the last event while allowing its edit", () => {
    const html = renderToStaticMarkup(<KarteEventTimeline events={[event("only", "booking", "2026-10-12")]} readOnly={false} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(html).toContain('aria-label="出来事を削除：予約成立" disabled=""');
    expect(html).toContain('aria-label="出来事を編集：予約成立"');
  });
});
