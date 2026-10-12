// @vitest-environment happy-dom
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { EditProfileModal } = await import("./EditProfileModal");
const { emptyProfileView } = await import("@/modules/profile/lib/mappers");
const uploads = vi.hoisted(() => ({ avatar: null as null | ((mediaId: string, url: string) => Promise<void>), cover: null as null | ((mediaId: string, url: string) => Promise<void>) }));
vi.mock("@/modules/profile/components/ImageUpload", () => ({ ImageUpload: ({ shape, onUploaded }: { shape: "avatar" | "cover"; onUploaded: (mediaId: string, url: string) => Promise<void> }) => { uploads[shape] = onUploaded; return null; } }));

describe("EditProfileModal", () => {
  it("keeps all edited and preserved profile fields and routes image saves through the existing payload", async () => {
    const profile = { ...emptyProfileView("p1"), username: "writer", displayName: "Writer", bio: "bio", website: "https://example.test", prefecture: "東京都", isPrivate: true, age: 25, industry: "デリヘル", bodyStats: { heightCm: 165, bust: 88, waist: 60, hip: 89, cup: "D" }, snsLinks: { x: "x", instagram: "instagram", tiktok: "tiktok", bluesky: "bluesky", line: "line", cityheaven: "cityheaven" } };
    const save = vi.fn().mockResolvedValue(undefined); const saveMedia = vi.fn().mockResolvedValue(undefined); const change = vi.fn();
    const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container);
    await act(async () => root.render(createElement(EditProfileModal, { open: true, onOpenChange: change, profile, isCast: true, onSave: save, onSaveMedia: saveMedia })));
    await act(async () => { await uploads.avatar?.("avatar-media", "https://example.test/avatar"); await uploads.cover?.("cover-media", "https://example.test/cover"); });
    expect(saveMedia.mock.calls).toEqual([[{ avatarMediaId: "avatar-media" }], [{ coverMediaId: "cover-media" }]]);
    await act(async () => (Array.from(document.querySelectorAll("button")).find((button) => button.textContent === "保存") as HTMLButtonElement).click());
    expect(save).toHaveBeenCalledWith({ username: "writer", displayName: "Writer", bio: "bio", website: "https://example.test", prefecture: "東京都", isPrivate: true, age: 25, industry: "デリヘル", bodyStats: profile.bodyStats, snsLinks: profile.snsLinks });
    expect(change).toHaveBeenCalledWith(false);
    await act(async () => root.unmount()); container.remove();
  });
  it("offers each industry by its icon and its name to a cast", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(EditProfileModal, {
          open: true,
          onOpenChange: () => {},
          profile: emptyProfileView("p1"),
          isCast: true,
          onSave: async () => {},
          onSaveMedia: async () => {},
        })
      );
    });
    const options = Array.from(document.querySelectorAll("#industry option"), (option) => option.textContent);

    expect(options).toContain("🚗 デリヘル");
    expect(options).toContain("🛁 ソープ");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
