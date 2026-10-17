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
    },
    latestEventAt: "2026-01-01T00:00:00.000Z",
    readAt: null,
    targetPostId: null,
    ...overrides,
  };
}

describe("describeNotificationAction", () => {
  it("describes a follow as being followed, not as an approval", () => {
    const n = buildNotification({ type: NotificationType.FOLLOW_APPROVED });
    expect(describeNotificationAction(n)).toBe("さんにフォローされました");
  });

  it("describes a pending follow request", () => {
    const n = buildNotification({ type: NotificationType.FOLLOW_REQUEST });
    expect(describeNotificationAction(n)).toBe("さんからフォロー申請が届きました");
  });

  it("appends the other-actors count for aggregated notifications", () => {
    const n = buildNotification({ type: NotificationType.LIKE, actorCount: 4 });
    expect(describeNotificationAction(n)).toBe("他 3 人 さんがいいねしました");
  });

  it("describes the action the same way when the actor is gone", () => {
    const n = buildNotification({ type: NotificationType.COMMENT, latestActor: null });
    expect(describeNotificationAction(n)).toBe("さんがコメントしました");
  });

  it("describes a mention notification", () => {
    const n = buildNotification({ type: NotificationType.MENTION });
    expect(describeNotificationAction(n)).toBe("さんがメンションしました");
  });
});

describe("notificationHref", () => {
  it("routes a follow notification to the actor's profile", () => {
    const n = buildNotification({ type: NotificationType.FOLLOW_APPROVED });
    expect(notificationHref(n)).toBe("/u/hanako");
  });

  it("routes a follow request notification to the follow-requests settings page", () => {
    const n = buildNotification({ type: NotificationType.FOLLOW_REQUEST });
    expect(notificationHref(n)).toBe("/settings/follow-requests");
  });

  it("routes a mention notification to its post", () => {
    const n = buildNotification({
      type: NotificationType.MENTION,
      targetPostId: "post-mention-1",
    });
    expect(notificationHref(n)).toBe("/posts/post-mention-1");
  });
});
