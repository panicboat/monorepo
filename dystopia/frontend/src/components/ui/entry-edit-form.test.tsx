// @vitest-environment happy-dom
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EntryEditForm, type EntryEditFormProps } from "./entry-edit-form";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const baseProps: EntryEditFormProps = {
  initialRating: 4,
  initialBody: "memo",
  saving: false,
  onSave: () => {},
  onCancel: () => {},
};

const optionValues = (html: string) => Array.from(html.matchAll(/<option value="([^"]+)"/g), (match) => match[1]);

function setValue(element: HTMLSelectElement | HTMLTextAreaElement, value: string) {
  const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLTextAreaElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value);
  element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
}

describe("EntryEditForm", () => {
  it("starts from the stored rating and body and offers whole ratings", () => {
    const html = renderToStaticMarkup(<EntryEditForm {...baseProps} />);

    expect(optionValues(html)).toEqual(["1", "2", "3", "4", "5"]);
    expect(html).toContain('<option value="4" selected="">★★★★☆ (4)</option>');
    expect(html).toContain(">memo</textarea>");
  });

  it("keeps a stored rating between two whole values selectable", () => {
    const html = renderToStaticMarkup(<EntryEditForm {...baseProps} initialRating={4.5} />);

    expect(optionValues(html)).toEqual(["1", "2", "3", "4", "4.5", "5"]);
    expect(html).toContain('<option value="4.5" selected="">★ 4.5</option>');
  });

  it("shows the reason a save failed", () => {
    const html = renderToStaticMarkup(<EntryEditForm {...baseProps} error="保存できませんでした" />);

    expect(html).toContain("保存できませんでした");
  });

  it("saves the edited rating and body, and cancels without saving", async () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(EntryEditForm, { ...baseProps, onSave, onCancel }));
    });

    await act(async () => {
      setValue(container.querySelector("select")!, "2");
      setValue(container.querySelector("textarea")!, "");
    });
    await act(async () => {
      container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(onSave.mock.calls).toEqual([[2, ""]]);

    await act(async () => {
      Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "キャンセル")!.click();
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
