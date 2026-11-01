// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ authFetch: vi.fn(), onOpenChange: vi.fn() }));

vi.mock("@/lib/auth", () => ({ authFetch: mocks.authFetch }));

const { ReportDialog } = await import("./ReportDialog");
const { useToastStore } = await import("@/stores/toastStore");

let root: Root;

async function mount() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(createElement(ReportDialog, { open: true, onOpenChange: mocks.onOpenChange, targetType: "post", targetId: "post-1" }));
  });
}

const submitButton = () => Array.from(document.querySelectorAll("button")).find((b) => b.textContent === "通報する") as HTMLButtonElement;
const reason = (label: string) =>
  Array.from(document.querySelectorAll("label")).find((l) => l.textContent === label)?.querySelector("input") as HTMLInputElement;

async function choose(label: string) {
  await act(async () => {
    reason(label).click();
  });
}

async function submit() {
  await act(async () => {
    submitButton().click();
  });
}

beforeEach(() => {
  mocks.authFetch.mockReset().mockResolvedValue({});
  mocks.onOpenChange.mockReset();
  useToastStore.setState({ message: null });
});

afterEach(async () => {
  await act(async () => root.unmount());
  document.body.innerHTML = "";
});

describe("ReportDialog", () => {
  it("offers the reasons named in the terms", async () => {
    await mount();

    expect(Array.from(document.querySelectorAll("label")).map((l) => l.textContent)).toEqual(
      expect.arrayContaining(["誹謗中傷", "脅迫", "つきまとい", "嫌がらせ", "その他"])
    );
  });

  it("cannot be sent until a reason is chosen", async () => {
    await mount();
    expect(submitButton().disabled).toBe(true);

    await choose("脅迫");

    expect(submitButton().disabled).toBe(false);
  });

  it("limits the note to 200 characters", async () => {
    await mount();

    expect(document.querySelector("textarea")?.maxLength).toBe(200);
  });

  it("sends the report, says it was received and closes", async () => {
    await mount();
    await choose("脅迫");
    await submit();

    expect(mocks.authFetch).toHaveBeenCalledWith("/api/reports", {
      method: "POST",
      body: { targetType: "post", targetId: "post-1", reason: "threat", note: "" },
    });
    expect(useToastStore.getState().message).toBe("通報を受け付けました");
    expect(mocks.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("stays open and tells the failure when sending fails", async () => {
    mocks.authFetch.mockRejectedValue(new Error("boom"));
    await mount();
    await choose("その他");
    await submit();

    expect(useToastStore.getState().message).toBe("通報できませんでした");
    expect(mocks.onOpenChange).not.toHaveBeenCalled();
  });
});
