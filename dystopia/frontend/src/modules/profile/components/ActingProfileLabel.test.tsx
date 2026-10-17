import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyProfileView } from "@/modules/profile/lib/mappers";
import type { ProfileView } from "@/modules/profile/types";

const mocks = vi.hoisted(() => ({ profile: null as ProfileView | null }));

vi.mock("@/modules/profile/hooks", () => ({
  useProfile: () => ({ profile: mocks.profile }),
}));

const { ActingProfileLabel } = await import("./ActingProfileLabel");

describe("ActingProfileLabel", () => {
  it("names the active profile the viewer is writing as", () => {
    mocks.profile = { ...emptyProfileView("profile-1"), displayName: "あかり", username: "akari" };

    const html = renderToStaticMarkup(<ActingProfileLabel />);

    expect(html).toContain("あかり");
    expect(html).toContain("@akari");
    expect(html).toContain("として");
  });

  it("renders nothing until the active profile is loaded", () => {
    mocks.profile = null;

    expect(renderToStaticMarkup(<ActingProfileLabel />)).toBe("");
  });
});
