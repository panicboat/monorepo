// @vitest-environment happy-dom
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ role: "cast" as "cast" | "guest" | null }));

vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: { role: string | null }) => unknown) => selector({ role: mocks.role }),
  selectRole: (state: { role: string | null }) => state.role,
}));
vi.mock("@/modules/post/components/PostComposerSheet", () => ({
  PostComposerSheet: ({ open }: { open: boolean }) => (open ? <div>post-composer</div> : null),
}));
vi.mock("./ComposeToSheet", () => ({
  ComposeToSheet: ({ kind, open, onClose }: { kind: string; open: boolean; onClose: () => void }) => (
    <button type="button" data-testid="compose-to" onClick={onClose}>
      compose-to:{kind}:{open ? "open" : "closed"}
    </button>
  ),
}));

const { ComposeLauncher } = await import("./ComposeLauncher");

const labels = (html: string) => Array.from(html.matchAll(/role="menuitem"[^>]*>.*?<span[^>]*>([^<]+)<\/span>/g), (match) => match[1]);

async function choose(label: string) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(ComposeLauncher, { variant: "fab" }));
  });
  await act(async () => {
    (Array.from(container.querySelectorAll('[role="menuitem"]')).find((el) => el.textContent?.includes(label)) as HTMLButtonElement).click();
  });
  const text = container.textContent ?? "";
  await act(async () => {
    root.unmount();
  });
  container.remove();
  return text;
}

describe("ComposeLauncher", () => {
  it("offers a cast a post, a message and a karte", () => {
    mocks.role = "cast";

    expect(labels(renderToStaticMarkup(<ComposeLauncher variant="fab" />))).toEqual(["投稿", "メッセージ", "カルテ"]);
  });

  it("offers a guest a post, a message and a review", () => {
    mocks.role = "guest";

    expect(labels(renderToStaticMarkup(<ComposeLauncher variant="sidebar" />))).toEqual(["投稿", "メッセージ", "クチコミ"]);
  });

  it("opens the post composer for a post", async () => {
    mocks.role = "cast";

    expect(await choose("投稿")).toContain("post-composer");
  });

  it("asks for a recipient for a message and for a karte entry", async () => {
    mocks.role = "cast";

    expect(await choose("メッセージ")).toContain("compose-to:message");
    expect(await choose("カルテ")).toContain("compose-to:karte");
  });

  it("keeps the sheet mounted while it closes, so it can slide out", async () => {
    mocks.role = "cast";
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(ComposeLauncher, { variant: "fab" }));
    });
    await act(async () => {
      (Array.from(container.querySelectorAll('[role="menuitem"]')).find((el) => el.textContent?.includes("カルテ")) as HTMLButtonElement).click();
    });
    expect(container.textContent).toContain("compose-to:karte:open");

    await act(async () => {
      (container.querySelector('[data-testid="compose-to"]') as HTMLButtonElement).click();
    });

    expect(container.textContent).toContain("compose-to:karte:closed");
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("labels the sidebar button as creating, since it leads to more than a post", () => {
    mocks.role = "cast";

    expect(renderToStaticMarkup(<ComposeLauncher variant="sidebar" />)).toContain("作成する");
  });
});
