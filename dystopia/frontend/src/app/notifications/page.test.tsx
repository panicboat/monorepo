import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NotificationsActions, NotificationsHeader } from "./page";

describe("NotificationsHeader", () => {
  it("renders a description of what this list is", () => {
    const html = renderToStaticMarkup(<NotificationsHeader />);

    expect(html).toContain("通知");
    expect(html).toContain("いいね・コメントなどのお知らせ");
  });
});

describe("NotificationsActions", () => {
  it("links to the notification settings next to marking everything read", () => {
    const html = renderToStaticMarkup(<NotificationsActions unreadCount={2} onMarkAllRead={() => {}} />);

    expect(html).toMatch(/<a[^>]*href="\/settings\/notifications"[^>]*>通知設定<\/a>/);
    expect(html).toContain("全て既読にする");
  });

  it("disables marking everything read when nothing is unread", () => {
    const html = renderToStaticMarkup(<NotificationsActions unreadCount={0} onMarkAllRead={() => {}} />);

    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>全て既読にする<\/button>/);
  });
});
