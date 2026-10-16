// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { revalidateKarte, useKarteRevalidation } from "./revalidate";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Registered({ refresh }: { refresh: () => unknown }) {
  useKarteRevalidation(refresh);
  return null;
}

describe("revalidateKarte", () => {
  it("calls every registered refresh and stops calling one after it unmounts", async () => {
    const first = vi.fn();
    const second = vi.fn();
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement("div", null, createElement(Registered, { refresh: first }), createElement(Registered, { refresh: second })));
    });

    await revalidateKarte();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.render(createElement(Registered, { refresh: first }));
    });
    await revalidateKarte();
    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledTimes(1);

    await act(async () => root.unmount());
    await revalidateKarte();
    expect(first).toHaveBeenCalledTimes(2);
  });
});
