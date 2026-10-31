// @vitest-environment happy-dom
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { LandingPage } from "./LandingPage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let unmount: (() => Promise<void>) | null = null;

async function mount() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  unmount = async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  };
  await act(async () => {
    root.render(createElement(LandingPage));
  });
  return container;
}

const entryHrefs = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("a.primary"), (a) => a.getAttribute("href"));
const pressed = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('button[aria-pressed="true"]'), (b) => b.textContent);

afterEach(async () => {
  await unmount?.();
  unmount = null;
  window.history.replaceState(null, "", "/");
});

describe("LandingPage", () => {
  it("opens on the cast page under the shared headline", () => {
    const html = renderToStaticMarkup(<LandingPage />);

    expect(html).toMatch(/<h1>夜に生きる人の、<br\/><em>もうひとつの街。<\/em><\/h1>/);
    expect(html).toContain('data-audience="cast"');
    expect(html).toContain("見せたい顔の数だけ、");
    expect(html).not.toContain("気になる人を、");
  });

  it("shows the cast schedule as a post without assuming fixed shifts", () => {
    const html = renderToStaticMarkup(<LandingPage />);

    expect(html).toContain("「今夜会えるよ」が、");
    expect(html).toContain("今日は気分がいいので、今夜少しだけ");
    expect(html).toContain("21:30〜");
    expect(html).toContain("お店を通さない約束や取引には使えません。");
    expect(html).not.toContain("今週の予定");
    expect(html).not.toContain("活動名");
  });

  it("leads a cast to sign up as a cast from both entry buttons", () => {
    const html = renderToStaticMarkup(<LandingPage />);

    expect(html.match(/<a class="primary" href="\/signup\?role=cast">キャストとして街で働く/g)).toHaveLength(2);
    expect(html).toMatch(/<a class="login" href="#entry">街で働く/);
    expect(html).not.toContain("街に入る");
  });

  it("keeps the way in for an existing account and the way out for a minor", () => {
    const html = renderToStaticMarkup(<LandingPage />);

    expect(html).toContain('href="/login"');
    expect(html).toContain('<a href="https://www.google.com">18歳未満の方はこちら</a>');
    expect(html).toContain("18歳以上の方が対象です");
  });

  it("links to the terms and the privacy policy from the footer", () => {
    const footer = renderToStaticMarkup(<LandingPage />).split("<footer")[1];

    expect(footer).toMatch(/<a href="\/terms">利用規約<\/a>/);
    expect(footer).toMatch(/<a href="\/privacy">プライバシーポリシー<\/a>/);
  });

  it("switches every part of the page to the guest side and remembers it in the address", async () => {
    const container = await mount();

    await act(async () => {
      Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "ゲストの方")!.click();
    });

    expect(pressed(container)).toEqual(["ゲスト", "ゲストの方"]);
    expect(entryHrefs(container)).toEqual(["/signup?role=guest", "/signup?role=guest"]);
    expect(container.textContent).toContain("ゲストとして街で遊ぶ");
    expect(container.querySelector("a.login")!.textContent).toContain("街で遊ぶ");
    expect(container.textContent).not.toContain("街で働く");
    expect(container.textContent).toContain("気になる人を、");
    expect(container.textContent).not.toContain("見せたい顔の数だけ、");
    expect(container.querySelector('a[href="#guest-values"]')).not.toBeNull();
    expect(window.location.search).toBe("?role=guest");
  });

  it("switches from the header as well as from the hero", async () => {
    const container = await mount();

    await act(async () => {
      Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "ゲスト")!.click();
    });
    expect(pressed(container)).toEqual(["ゲスト", "ゲストの方"]);

    await act(async () => {
      Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "キャスト")!.click();
    });
    expect(pressed(container)).toEqual(["キャスト", "キャストの方"]);
    expect(window.location.search).toBe("?role=cast");
  });

  it("opens on the guest page when the address asks for it", async () => {
    window.history.replaceState(null, "", "/?role=guest");

    const container = await mount();

    expect(pressed(container)).toEqual(["ゲスト", "ゲストの方"]);
    expect(entryHrefs(container)).toEqual(["/signup?role=guest", "/signup?role=guest"]);
  });
});
