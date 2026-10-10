// @vitest-environment happy-dom
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TimeSelect } from "./TimeSelect";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const minuteOptions = (html: string) => {
  const minuteSelect = html.split("（分）")[1] ?? "";
  return Array.from(minuteSelect.matchAll(/<option value="([^"]*)"/g), (match) => match[1]);
};

async function choose(value: string, label: string, next: string) {
  const onChange = vi.fn();
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(TimeSelect, { label: "開始時刻", value, onChange }));
  });
  const select = container.querySelector(`select[aria-label="開始時刻（${label}）"]`) as HTMLSelectElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(select, next);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(async () => {
    root.unmount();
  });
  container.remove();
  return onChange.mock.calls;
}

describe("TimeSelect", () => {
  it("offers every hour and the minutes in 15-minute steps", () => {
    const html = renderToStaticMarkup(<TimeSelect label="開始時刻" value="18:30" onChange={() => {}} />);

    expect(html.match(/<option value="\d\d"/g)?.length).toBe(24 + 4);
    expect(minuteOptions(html)).toEqual(["00", "15", "30", "45"]);
    expect(html).toContain('<option value="18" selected="">18</option>');
    expect(html).toContain('<option value="30" selected="">30</option>');
  });

  it("starts empty with no time filled in, and keeps the minutes unavailable until an hour is chosen", () => {
    const html = renderToStaticMarkup(<TimeSelect label="開始時刻" value="" onChange={() => {}} />);

    expect(html).toContain('<option value="" selected="">--</option>');
    expect(html).toMatch(/<select[^>]*disabled=""[^>]*aria-label="開始時刻（分）"/);
  });

  it("sets the time on the hour when an hour is chosen from empty", async () => {
    expect(await choose("", "時", "20")).toEqual([["20:00"]]);
  });

  it("keeps the other part when the hour or the minute is changed", async () => {
    expect(await choose("20:30", "時", "21")).toEqual([["21:30"]]);
    expect(await choose("20:30", "分", "45")).toEqual([["20:45"]]);
  });

  it("clears the time when the hour is set back to empty", async () => {
    expect(await choose("20:30", "時", "")).toEqual([[""]]);
  });

  it("keeps a stored minute that is off the 15-minute step selectable", () => {
    const html = renderToStaticMarkup(<TimeSelect label="開始時刻" value="18:10" onChange={() => {}} />);

    expect(minuteOptions(html)).toEqual(["00", "10", "15", "30", "45"]);
    expect(html).toContain('<option value="10" selected="">10</option>');
  });
});
