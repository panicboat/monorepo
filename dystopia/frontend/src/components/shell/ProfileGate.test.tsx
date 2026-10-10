// @vitest-environment happy-dom
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { ProfileGate } = await import("./ProfileGate");

describe("ProfileGate", () => {
  it("renders the heading for each blocked reason", () => {
    const headings = [
      ["error", "プロフィールを読み込めませんでした"],
      ["unavailable", "このプロフィールは利用できません"],
    ] as const;

    for (const [reason, heading] of headings) {
      const html = renderToStaticMarkup(
        <ProfileGate reason={reason} onRetry={() => {}} />
      );
      expect(html).toContain(heading);
    }
  });

  it("offers retry as the only action for every blocked reason", () => {
    for (const reason of ["error", "unavailable"] as const) {
      const html = renderToStaticMarkup(
        <ProfileGate reason={reason} onRetry={() => {}} />
      );
      expect(html.match(/<button/g)).toHaveLength(1);
      expect(html).toContain("再試行");
    }
  });

  it("calls the retry handler from its button", async () => {
    const onRetry = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(ProfileGate, { reason: "unavailable", onRetry }));
    });
    const buttons = Array.from(container.querySelectorAll("button"));

    await act(async () => {
      buttons.find((button) => button.textContent === "再試行")?.click();
    });

    expect(onRetry).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
