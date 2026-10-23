// @vitest-environment happy-dom
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const useMediaUploadMock = vi.hoisted(() => vi.fn());
vi.mock("@/modules/profile/hooks/useMediaUpload", () => ({ useMediaUpload: useMediaUploadMock }));

const { ImageUpload } = await import("./ImageUpload");

async function render(error: string | null) {
  useMediaUploadMock.mockReturnValue({ upload: vi.fn(), uploading: false, error });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(ImageUpload, { shape: "avatar", onUploaded: () => {} }));
  });
  return {
    container,
    cleanup: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("ImageUpload", () => {
  it("shows why an upload failed", async () => {
    const { container, cleanup } = await render("画像を読み込めませんでした。別の画像を選んでください");

    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "画像を読み込めませんでした。別の画像を選んでください"
    );

    await cleanup();
  });

  it("shows no alert while there is no error", async () => {
    const { container, cleanup } = await render(null);

    expect(container.querySelector('[role="alert"]')).toBeNull();

    await cleanup();
  });
});
