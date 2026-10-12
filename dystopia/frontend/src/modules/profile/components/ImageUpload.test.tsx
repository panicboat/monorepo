// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImageUpload } from "./ImageUpload";
import { useAuthStore } from "@/stores/authStore";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const upload = vi.hoisted(() => vi.fn());
vi.mock("@/modules/profile/hooks/useMediaUpload", () => ({ useMediaUpload: () => ({ upload, uploading: false, error: null }) }));
let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
afterEach(async () => { await act(async () => root?.unmount()); });
async function select() { const input = container.querySelector("input") as HTMLInputElement; Object.defineProperty(input, "files", { configurable: true, value: [new File(["image"], "avatar.png", { type: "image/png" })] }); await act(async () => input.dispatchEvent(new Event("change", { bubbles: true }))); }
describe("ImageUpload", () => {
  it("waits for the media assignment and presents its save error", async () => {
    useAuthStore.setState({ accountId: "owner", activeProfileId: "writer" }); upload.mockResolvedValue({ mediaId: "image", url: "https://example.test/image" });
    const failure = Promise.reject(new Error("画像を保存できません"));
    // SILENT: Observe the rejected callback before the upload handler consumes it so the runner can inspect the UI.
    void failure.catch(() => {});
    container = document.createElement("div"); root = createRoot(container);
    await act(async () => root.render(createElement(ImageUpload, { shape: "avatar", onUploaded: () => failure })));
    await select(); expect(container.textContent).toContain("画像を保存できません");
  });
  it("does not assign an image to a different acting profile", async () => {
    useAuthStore.setState({ accountId: "owner", activeProfileId: "writer" });
    let finish!: (value: { mediaId: string; url: string }) => void; upload.mockImplementation(() => new Promise((resolve) => { finish = resolve; })); const assigned = vi.fn();
    container = document.createElement("div"); root = createRoot(container);
    await act(async () => root.render(createElement(ImageUpload, { shape: "avatar", onUploaded: assigned })));
    await select(); await act(async () => useAuthStore.getState().setActiveProfile("another"));
    await act(async () => finish({ mediaId: "old-image", url: "https://example.test/image" })); expect(assigned).not.toHaveBeenCalled();
  });
});
