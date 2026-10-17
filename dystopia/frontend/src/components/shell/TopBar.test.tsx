import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/modules/profile/hooks", () => ({ useProfile: () => ({ profile: null }) }));
vi.mock("@/modules/notifications/hooks", () => ({ useUnreadCount: () => ({ count: 0 }) }));

const { TopBar } = await import("./TopBar");

describe("TopBar", () => {
  it("stands 62px tall on the app surface with a rule below", () => {
    const html = renderToStaticMarkup(<TopBar onAvatarClick={() => {}} />);
    const header = /<header class="([^"]*)"/.exec(html)?.[1].split(/\s+/) ?? [];

    expect(header).toEqual(expect.arrayContaining(["h-[62px]", "bg-bg", "border-b", "border-divider"]));
  });

  it("opens the menu from the avatar and links to notifications", () => {
    const html = renderToStaticMarkup(<TopBar onAvatarClick={() => {}} />);

    expect(html).toContain('aria-label="メニューを開く"');
    expect(html).toContain('href="/notifications"');
  });
});
