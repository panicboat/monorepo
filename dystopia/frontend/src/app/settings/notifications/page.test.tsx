import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/modules/notifications/components/NotificationSettings", () => ({
  NotificationSettings: () => <div data-testid="notification-settings" />,
}));

const { default: NotificationSettingsPage } = await import("./page");

describe("NotificationSettingsPage", () => {
  it("shows the notification settings under their own heading", () => {
    const html = renderToStaticMarkup(<NotificationSettingsPage />);

    expect(html).toContain("<h1");
    expect(html).toContain("通知設定");
    expect(html).toContain('data-testid="notification-settings"');
  });
});
