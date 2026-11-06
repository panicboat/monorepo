// @vitest-environment happy-dom
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UploadedMedia } from "@/modules/media/types";
import type { ReviewMedia } from "../types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ uploadMedia: vi.fn() }));

vi.mock("@/modules/media/hooks/useMediaUpload", () => ({ useMediaUpload: () => ({ uploadMedia: mocks.uploadMedia }) }));

const { ReviewEventAttachments } = await import("./ReviewEventAttachments");

const media = (id: string, overrides: Partial<ReviewMedia> = {}): ReviewMedia => ({
  mediaId: id, mediaType: "image", url: `https://cdn.example/${id}.jpg`, thumbnailUrl: `https://cdn.example/${id}-thumb.jpg`, ...overrides,
});

const uploaded = (id: string, overrides: Partial<UploadedMedia> = {}): UploadedMedia => ({
  mediaId: id, mediaKey: `key-${id}`, uploadUrl: "https://upload.example", localUrl: `blob:${id}`, filename: `${id}.jpg`, contentType: "image/jpeg", sizeBytes: 1, mediaType: "image", ...overrides,
});

function Harness({ initial, onChange, onUploadingChange, disabled = false }: { initial: ReviewMedia[]; onChange: (next: ReviewMedia[]) => void; onUploadingChange: (uploading: boolean) => void; disabled?: boolean }) {
  const [items, setItems] = useState(initial);
  return createElement(ReviewEventAttachments, {
    items,
    onChange: (next: ReviewMedia[]) => {
      onChange(next);
      setItems(next);
    },
    onUploadingChange,
    disabled,
  });
}

async function mount(initial: ReviewMedia[], disabled = false) {
  const onChange = vi.fn();
  const onUploadingChange = vi.fn();
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(createElement(Harness, { initial, onChange, onUploadingChange, disabled }));
  });
  return { container, onChange, onUploadingChange };
}

const addButton = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "画像/動画を追加" || b.textContent === "アップロード中…") as HTMLButtonElement;

async function chooseFiles(container: HTMLElement, files: File[]) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, "files", { value: files, configurable: true });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

const file = (name: string, type = "image/jpeg") => new File(["x"], name, { type });

beforeEach(() => {
  document.body.innerHTML = "";
  mocks.uploadMedia.mockReset();
});

describe("ReviewEventAttachments", () => {
  it("offers the same labels as a post for choosing files", async () => {
    const { container } = await mount([]);

    expect(addButton(container).textContent).toBe("画像/動画を追加");
    expect(container.querySelector('input[type="file"]')?.getAttribute("aria-label")).toBe("画像や動画を選択");
  });

  it("disables adding at four attachments and removes one with its delete button", async () => {
    const { container, onChange } = await mount([media("m-1"), media("m-2"), media("m-3"), media("m-4")]);

    expect(addButton(container).disabled).toBe(true);

    await act(async () => (container.querySelector('button[aria-label="画像を削除"]') as HTMLButtonElement).click());

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].map((item: ReviewMedia) => item.mediaId)).toEqual(["m-2", "m-3", "m-4"]);
    expect(addButton(container).disabled).toBe(false);
  });

  it("names the delete button by type for media that came from the server", async () => {
    const { container } = await mount([media("m-1"), media("m-2", { mediaType: "video" })]);

    expect(container.querySelectorAll('button[aria-label="画像を削除"]')).toHaveLength(1);
    expect(container.querySelectorAll('button[aria-label="動画を削除"]')).toHaveLength(1);
  });

  it("adds an uploaded file with its local url as both url and thumbnail and names the delete button by filename", async () => {
    mocks.uploadMedia.mockResolvedValue(uploaded("m-9", { filename: "selfie.jpg" }));
    const { container, onChange, onUploadingChange } = await mount([media("m-1")]);

    await chooseFiles(container, [file("selfie.jpg")]);

    expect(mocks.uploadMedia).toHaveBeenCalledWith(expect.any(File), { registerAfterUpload: true });
    expect(onChange).toHaveBeenCalledWith([media("m-1"), { mediaId: "m-9", mediaType: "image", url: "blob:m-9", thumbnailUrl: "blob:m-9" }]);
    expect(onUploadingChange.mock.calls).toEqual([[true], [false]]);
    expect(container.querySelector('button[aria-label="selfie.jpgを削除"]')).not.toBeNull();
  });

  it("keeps the uploaded video as a video", async () => {
    mocks.uploadMedia.mockResolvedValue(uploaded("m-9", { filename: "clip.mp4", mediaType: "video" }));
    const { container, onChange } = await mount([]);

    await chooseFiles(container, [file("clip.mp4", "video/mp4")]);

    expect(onChange).toHaveBeenCalledWith([{ mediaId: "m-9", mediaType: "video", url: "blob:m-9", thumbnailUrl: "blob:m-9" }]);
    expect(container.querySelector("video")?.getAttribute("src")).toBe("blob:m-9");
  });

  it("uses only as many of the chosen files as there are free slots", async () => {
    mocks.uploadMedia.mockImplementation(async (chosen: File) => uploaded(chosen.name));
    const { container, onChange } = await mount([media("m-1"), media("m-2"), media("m-3")]);

    await chooseFiles(container, [file("a.jpg"), file("b.jpg")]);

    expect(mocks.uploadMedia).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toHaveLength(4);
  });

  it("shows the upload error below the list and leaves the attachments as they were", async () => {
    mocks.uploadMedia.mockRejectedValue(new Error("画像を読み込めませんでした。別の画像を選んでください"));
    const { container, onChange, onUploadingChange } = await mount([media("m-1")]);

    await chooseFiles(container, [file("broken.jpg")]);

    expect(container.querySelector('[role="alert"]')?.textContent).toBe("画像を読み込めませんでした。別の画像を選んでください");
    expect(onChange).not.toHaveBeenCalled();
    expect(onUploadingChange.mock.calls).toEqual([[true], [false]]);
  });

  it("falls back to a generic message when the upload throws something that is not an Error", async () => {
    mocks.uploadMedia.mockRejectedValue("boom");
    const { container } = await mount([]);

    await chooseFiles(container, [file("broken.jpg")]);

    expect(container.querySelector('[role="alert"]')?.textContent).toBe("アップロードに失敗しました");
  });

  it("shows the progress label and blocks adding while uploading", async () => {
    let finish: (value: UploadedMedia) => void = () => {};
    mocks.uploadMedia.mockReturnValue(new Promise<UploadedMedia>((resolve) => (finish = resolve)));
    const { container } = await mount([]);

    await chooseFiles(container, [file("a.jpg")]);
    expect(addButton(container).textContent).toBe("アップロード中…");
    expect(addButton(container).disabled).toBe(true);

    await act(async () => finish(uploaded("m-1")));
    expect(addButton(container).textContent).toBe("画像/動画を追加");
  });

  it("blocks adding and removing while the form is submitting", async () => {
    const { container } = await mount([media("m-1")], true);

    expect(addButton(container).disabled).toBe(true);
    expect((container.querySelector('button[aria-label="画像を削除"]') as HTMLButtonElement).disabled).toBe(true);
  });
});
