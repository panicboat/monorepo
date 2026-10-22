// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScheduleSearchResultView } from "@/modules/schedule/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ activeProfileId: "viewer-1" as string | null, followTargets: [] as string[] }));

vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: { activeProfileId: string | null }) => unknown) => selector({ activeProfileId: mocks.activeProfileId }),
  selectActiveProfileId: (state: { activeProfileId: string | null }) => state.activeProfileId,
}));
vi.mock("@/modules/social/hooks", () => ({
  useFollow: (targetProfileId: string) => {
    mocks.followTargets.push(targetProfileId);
    return {
      status: 0,
      isFollowing: false,
      isPending: false,
      approvalRequired: false,
      follow: vi.fn(),
      unfollow: vi.fn(),
      cancelRequest: vi.fn(),
      loading: false,
    };
  },
}));

const { ScheduleSearchCard } = await import("./ScheduleSearchCard");

const BASE: ScheduleSearchResultView = {
  schedule: { profileId: "cast-1", workDate: "2026-10-22", startTime: "16:00", endTime: "22:00" },
  profile: { profileId: "cast-1", username: "suzu_21", displayName: "すず", avatarUrl: "", isPrivate: false, role: "cast", industry: "箱ヘル" },
  prefecture: "東京都",
  area: "",
  note: "",
};

let container: HTMLElement;
let unmount: () => Promise<void>;

interface Overrides {
  schedule?: Partial<ScheduleSearchResultView["schedule"]>;
  profile?: Partial<ScheduleSearchResultView["profile"]>;
  prefecture?: string;
  area?: string;
  note?: string;
}

async function mount(result: Overrides = {}) {
  const value: ScheduleSearchResultView = {
    ...BASE,
    ...result,
    schedule: { ...BASE.schedule, ...result.schedule },
    profile: { ...BASE.profile, ...result.profile },
  };
  container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  unmount = async () => {
    await act(async () => root.unmount());
    container.remove();
  };
  await act(async () => {
    root.render(createElement(ScheduleSearchCard, { result: value }));
  });
}

const buttons = () => Array.from(container.querySelectorAll("button")).map((b) => b.textContent);

beforeEach(() => {
  mocks.activeProfileId = "viewer-1";
  mocks.followTargets = [];
});

afterEach(async () => {
  await unmount();
});

describe("ScheduleSearchCard", () => {
  it("shows the name, the @username, the work hours and the work date", async () => {
    await mount();

    expect(container.textContent).toContain("すず");
    expect(container.textContent).toContain("@suzu_21");
    expect(container.textContent).toContain("16:00〜22:00");
    expect(container.textContent).toContain("10/22（木）");
  });

  it("shows the area in the name row and the industry icon in the schedule summary, as on posts", async () => {
    await mount();

    const icon = container.querySelector('[role="img"]') as HTMLElement;
    expect(icon.textContent).toBe("📦");
    expect(icon.getAttribute("aria-label")).toBe("箱ヘル");
    expect(icon.closest(".rounded-xl")?.textContent).toContain("10/22（木）");
    expect(icon.closest(".rounded-xl")?.textContent).not.toContain("東京都");
    expect(container.textContent).toContain("東京都");
  });

  it("puts the note above the schedule summary, as a post puts its text above the card", async () => {
    await mount({ note: "久しぶりの出勤。" });

    const text = container.textContent ?? "";
    expect(text.indexOf("久しぶりの出勤。")).toBeLessThan(text.indexOf("出勤16:00"));
  });

  it("shows no icon for an empty or unlisted industry", async () => {
    await mount({ profile: { industry: "" } });
    expect(container.querySelector('[role="img"]')).toBeNull();
    await unmount();

    await mount({ profile: { industry: "未登録の業種" } });
    expect(container.querySelector('[role="img"]')).toBeNull();
    expect(container.textContent).not.toContain("未登録の業種");
  });

  it("shows the main area after the prefecture", async () => {
    await mount({ area: "新宿" });

    expect(container.textContent).toContain("東京都 / 新宿");
  });

  it("shows no area when the profile has none", async () => {
    await mount({ prefecture: "" });

    expect(container.textContent).not.toContain("東京都");
  });

  it("adds 翌日 when the start is before 05:00, because it belongs to the night of its work date", async () => {
    await mount({ schedule: { startTime: "01:00", endTime: "05:00" } });
    expect(container.textContent).toContain("01:00〜05:00");
    expect(container.textContent).toContain("翌日");
    await unmount();

    await mount({ schedule: { startTime: "05:00", endTime: "12:00" } });
    expect(container.textContent).not.toContain("翌日");
  });

  it("adds 翌日 when the end is at or before the start, and not otherwise", async () => {
    await mount({ schedule: { startTime: "20:00", endTime: "02:00" } });
    expect(container.textContent).toContain("20:00〜02:00");
    expect(container.textContent).toContain("翌日");
    await unmount();

    await mount({ schedule: { startTime: "20:00", endTime: "20:00" } });
    expect(container.textContent).toContain("翌日");
    await unmount();

    await mount({ schedule: { startTime: "16:00", endTime: "22:00" } });
    expect(container.textContent).not.toContain("翌日");
  });

  it("shows the note only when there is one", async () => {
    await mount({ note: "" });
    const withoutNote = container.querySelectorAll("p").length;
    await unmount();

    await mount({ note: "久しぶりの出勤。よろしくお願いします。" });

    expect(container.textContent).toContain("久しぶりの出勤。よろしくお願いします。");
    expect(container.querySelectorAll("p")).toHaveLength(withoutNote + 1);
  });

  it("links the avatar, the name and プロフィール → to the profile's schedule tab", async () => {
    await mount({ profile: { username: "suzu_21" } });

    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs.length).toBeGreaterThanOrEqual(2);
    expect(new Set(hrefs)).toEqual(new Set(["/u/suzu_21?tab=schedule"]));
    expect(Array.from(container.querySelectorAll("a")).some((a) => a.textContent === "プロフィール →")).toBe(true);
  });

  it("offers to follow the cast", async () => {
    await mount();

    expect(buttons()).toContain("フォロー");
    expect(mocks.followTargets).toContain("cast-1");
  });

  it("shows no follow button on the viewer's own profile but keeps the profile link", async () => {
    mocks.activeProfileId = "cast-1";
    await mount();

    expect(buttons()).not.toContain("フォロー");
    expect(Array.from(container.querySelectorAll("a")).some((a) => a.textContent === "プロフィール →")).toBe(true);
  });

  it("marks a locked profile", async () => {
    await mount({ profile: { isPrivate: true } });

    expect(container.innerHTML).toContain('aria-label="鍵付き"');
  });
});
