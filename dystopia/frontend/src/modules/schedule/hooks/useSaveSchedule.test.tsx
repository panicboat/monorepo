// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ authFetch: vi.fn() }));

vi.mock("@/lib/auth/fetch", () => ({ authFetch: mocks.authFetch }));

const { useSaveSchedule } = await import("./useSaveSchedule");

describe("useSaveSchedule", () => {
  it("posts the shift together with the announcement", async () => {
    mocks.authFetch.mockResolvedValue(undefined);
    let save!: ReturnType<typeof useSaveSchedule>;
    function Probe() {
      save = useSaveSchedule();
      return null;
    }
    const container = document.createElement("div");
    await act(async () => {
      createRoot(container).render(createElement(Probe));
    });

    await save("2026-10-24", "20:00", "02:00", { announce: true, announceTime: "09:00", announceNote: "お待ちしてます！" });

    expect(mocks.authFetch).toHaveBeenCalledWith("/api/schedule/save", {
      method: "POST",
      body: {
        workDate: "2026-10-24",
        startTime: "20:00",
        endTime: "02:00",
        announce: true,
        announceTime: "09:00",
        announceNote: "お待ちしてます！",
      },
    });
  });
});
