import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ footprintUnreadBadge: true as boolean | undefined }));

vi.mock("@/modules/notifications/hooks", () => ({
  useUnreadCount: () => ({ count: 1 }),
  useNotificationPreferences: () => ({ preferences: { footprintUnreadBadge: mocks.footprintUnreadBadge } }),
}));
vi.mock("@/modules/messaging", () => ({ useTotalUnread: () => ({ count: 2 }) }));
vi.mock("@/modules/footprints", () => ({ useFootprintsUnreadCount: () => ({ count: 3 }) }));

const { useNavBadgeCount } = await import("./useNavBadgeCount");

let countOf: ReturnType<typeof useNavBadgeCount>;
function Probe() {
  countOf = useNavBadgeCount();
  return null;
}

beforeEach(() => {
  mocks.footprintUnreadBadge = true;
  renderToStaticMarkup(<Probe />);
});

describe("useNavBadgeCount", () => {
  it("returns the count of each badge", () => {
    expect(countOf("unread")).toBe(1);
    expect(countOf("messaging_unread")).toBe(2);
    expect(countOf("footprints_unread")).toBe(3);
  });

  it("returns zero for an item without a badge", () => {
    expect(countOf(undefined)).toBe(0);
  });

  it("hides the footprints count when its badge is turned off", () => {
    mocks.footprintUnreadBadge = false;
    renderToStaticMarkup(<Probe />);

    expect(countOf("footprints_unread")).toBe(0);
  });
});
