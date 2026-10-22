import { describe, expect, it } from "vitest";
import { NotificationType } from "@/stub/notifications/v1/notification_service_pb";
import { describeNotificationAction, notificationHref } from "./format";
import type { NotificationView } from "../types";

function buildNotification(overrides: Partial<NotificationView>): NotificationView {
  return {
    id: "notif-1",
    type: NotificationType.LIKE,
    targetResourceId: "post-1",
    actorCount: 1,
    latestActor: {
      profileId: "actor-1",
      username: "hanako",
      displayName: "花子",
      avatarUrl: "",
      isPrivate: false,
      role: "guest",
      industry: "",
    },
    latestEventAt: "2026-01-01T00:00:00.000Z",
    readAt: null,
    targetPostId: null,
    ...overrides,
  };
}

describe("describeNotificationAction", () => {
  it.each([
    [NotificationType.LIKE, "あなたの投稿にいいねしました"],
    [NotificationType.COMMENT, "あなたの投稿にコメントしました"],
    [NotificationType.REPLY, "あなたのコメントに返信しました"],
    [NotificationType.MENTION, "あなたをメンションしました"],
    [NotificationType.FOLLOW_REQUEST, "フォロー申請が届きました"],
    [NotificationType.FOLLOW_APPROVED, "あなたをフォローしました"],
  ])("describes type %s without the actor's name", (type, expected) => {
    expect(describeNotificationAction(buildNotification({ type }))).toBe(expected);
  });

  it("leads with the other-actors count for aggregated notifications", () => {
    const n = buildNotification({ type: NotificationType.LIKE, actorCount: 3 });
    expect(describeNotificationAction(n)).toBe("ほか 2 人もあなたの投稿にいいねしました");
  });

  it("describes the action the same way when the actor is gone", () => {
    const n = buildNotification({ type: NotificationType.COMMENT, latestActor: null });
    expect(describeNotificationAction(n)).toBe("あなたの投稿にコメントしました");
  });

  it("falls back to a generic line for an unknown type", () => {
    const n = buildNotification({ type: NotificationType.UNSPECIFIED });
    expect(describeNotificationAction(n)).toBe("お知らせがあります");
  });
});

describe("notificationHref", () => {
  it("routes a follow notification to the actor's profile", () => {
    const n = buildNotification({ type: NotificationType.FOLLOW_APPROVED });
    expect(notificationHref(n, "yuna")).toBe("/u/hanako");
  });

  it("routes a follow request notification to the viewer's own requests tab", () => {
    const n = buildNotification({ type: NotificationType.FOLLOW_REQUEST });
    expect(notificationHref(n, "yuna")).toBe("/u/yuna/requests");
    expect(notificationHref(n, null)).toBeNull();
  });

  it("routes a mention notification to its post", () => {
    const n = buildNotification({
      type: NotificationType.MENTION,
      targetPostId: "post-mention-1",
    });
    expect(notificationHref(n, "yuna")).toBe("/posts/post-mention-1");
  });
});
