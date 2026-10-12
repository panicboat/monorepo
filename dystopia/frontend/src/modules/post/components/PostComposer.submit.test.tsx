// @vitest-environment happy-dom
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { PostComposer } from "./PostComposer";
const upload = vi.hoisted(() => vi.fn());
vi.mock("@/modules/media/hooks/useMediaUpload", () => ({ useMediaUpload: () => ({ uploadMedia: upload }) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("PostComposer submit", () => {
  it("preserves an attachment after a failed save and releases its preview when the form closes", async () => {
    const image = { mediaId: "media-1", mediaKey: "image", mediaType: "image", filename: "photo.jpg", contentType: "image/jpeg", sizeBytes: 10, localUrl: "blob:image", uploadUrl: "https://example.test" };
    upload.mockResolvedValue(image);
    const release = vi.spyOn(URL, "revokeObjectURL");
    const onSubmit = vi.fn().mockRejectedValue(new Error("保存できませんでした"));
    const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container);
    await act(async () => root.render(createElement(PostComposer, { onSubmit, initialContent: "添付つきの投稿", initialVisibility: "private" })));
    const input = container.querySelector('[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, "files", { configurable: true, value: [new File(["image"], "photo.jpg", { type: "image/jpeg" })] });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
    await act(async () => (container.querySelector("form") as HTMLFormElement).dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(onSubmit).toHaveBeenCalledWith({ content: "添付つきの投稿", visibility: "private", media: [{ mediaId: "media-1", mediaType: "image" }], hashtags: [] });
    expect(container.querySelector('img')?.getAttribute("src")).toBe("blob:image");
    expect((container.querySelector("textarea") as HTMLTextAreaElement).value).toBe("添付つきの投稿"); expect(release).not.toHaveBeenCalled();
    await act(async () => root.unmount()); expect(release).toHaveBeenCalledWith("blob:image"); container.remove(); release.mockRestore();
  });
  it("sends the tags written in the text along with the post", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(PostComposer, { onSubmit }));
    });

    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(textarea, "新作届いた #新作 #渋谷");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ content: "新作届いた #新作 #渋谷", hashtags: ["新作", "渋谷"] })
    );

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
