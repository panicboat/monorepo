import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NotificationType } from "@/stub/notifications/v1/notification_service_pb";
import type { NotificationView } from "@/modules/notifications/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const { NotificationRow } = await import("./page");

const notification: NotificationView = {
  id: "n-1",
  type: NotificationType.LIKE,
  targetResourceId: "post-1",
  actorCount: 1,
  latestActor: { profileId: "a1", username: "hanako", displayName: "花子", avatarUrl: "", isPrivate: false, role: "guest", industry: "" },
  latestEventAt: "2026-01-01T00:00:00.000Z",
  readAt: null,
  targetPostId: null,
};

describe("NotificationRow", () => {
  it("shows the actor's name followed by the action", () => {
    const html = renderToStaticMarkup(<NotificationRow notification={notification} onClick={() => {}} />);

    expect(html).toContain("花子");
    expect(html).toContain("あなたの投稿にいいねしました");
  });

  it("marks only an actor whose profile is locked", () => {
    const locked = renderToStaticMarkup(
      <NotificationRow
        notification={{ ...notification, latestActor: { ...notification.latestActor!, isPrivate: true } }}
        onClick={() => {}}
      />
    );
    const open = renderToStaticMarkup(<NotificationRow notification={notification} onClick={() => {}} />);

    expect(locked).toContain('aria-label="鍵付き"');
    expect(open).not.toContain('aria-label="鍵付き"');
  });

  it("shows a deleted-profile label when the actor is gone", () => {
    const html = renderToStaticMarkup(
      <NotificationRow notification={{ ...notification, latestActor: null }} onClick={() => {}} />
    );

    expect(html).toContain("（無効なユーザー）");
  });

  it("opens the notification from the card and links the actor to their profile outside it", () => {
    const html = renderToStaticMarkup(<NotificationRow notification={notification} onClick={() => {}} />);
    const card = html.match(/<button[^>]*>(.*?)<\/button>/)?.[1] ?? "";

    expect(card).toContain("あなたの投稿にいいねしました");
    expect(card).not.toContain("<a ");
    expect(html.match(/<a[^>]*href="\/u\/hanako"/g)?.length).toBe(2);
  });

  it("marks only an unread notification", () => {
    const unread = renderToStaticMarkup(<NotificationRow notification={notification} onClick={() => {}} />);
    const read = renderToStaticMarkup(
      <NotificationRow notification={{ ...notification, readAt: "2026-01-02T00:00:00.000Z" }} onClick={() => {}} />
    );

    expect(unread).toContain('aria-label="未読"');
    expect(read).not.toContain('aria-label="未読"');
  });
});
