// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const resizeMocks = vi.hoisted(() => ({ resizeImage: vi.fn() }));

vi.mock("../lib/resize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/resize")>()),
  resizeImage: resizeMocks.resizeImage,
}));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: Object.assign(() => null, { getState: () => ({ activeProfileId: "p-1" }) }),
}));
vi.mock("@/lib/auth/profile-headers", () => ({ profileRequestHeaders: () => ({}) }));

const { useMediaUpload } = await import("./useMediaUpload");

type Hook = ReturnType<typeof useMediaUpload>;
let hook: Hook | null = null;
function Probe() {
  hook = useMediaUpload();
  return null;
}

const calls: { url: string; method: string; body: unknown; contentType?: string }[] = [];
let issued = 0;

beforeEach(async () => {
  calls.length = 0;
  issued = 0;
  resizeMocks.resizeImage.mockReset().mockImplementation(async (_file: Blob, maxEdge: number) =>
    new Blob(["x".repeat(maxEdge === 640 ? 10 : 100)], { type: "image/jpeg" })
  );
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:local" }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: { method: string; body: unknown; headers?: Record<string, string> }) => {
      const body = typeof init.body === "string" ? JSON.parse(init.body) : init.body;
      calls.push({ url, method: init.method, body, contentType: init.headers?.["Content-Type"] });
      if (url === "/api/media/upload-url") {
        issued += 1;
        return { ok: true, json: async () => ({ uploadUrl: `https://s3/put-${issued}`, mediaKey: `media/p-1/k${issued}.jpg`, mediaId: `m${issued}` }) };
      }
      return { ok: true, json: async () => ({}) };
    })
  );
  await act(async () => createRoot(document.createElement("div")).render(createElement(Probe)));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const upload = async (file: File) => {
  let result: Awaited<ReturnType<Hook["uploadMedia"]>> | undefined;
  await act(async () => {
    result = await hook!.uploadMedia(file, { registerAfterUpload: true });
  });
  return result!;
};

const registered = () => calls.find((call) => call.url === "/api/media/register")!.body as Record<string, unknown>;
const puts = () => calls.filter((call) => call.method === "PUT");

describe("useMediaUpload", () => {
  it("uploads a shrunk JPEG and a thumbnail for a photo and registers both", async () => {
    const result = await upload(new File(["original"], "IMG_0001.HEIC", { type: "image/heic" }));

    expect(resizeMocks.resizeImage.mock.calls.map((call) => call[1])).toEqual([2048, 640]);
    expect(puts().map((call) => [call.url, call.contentType, (call.body as Blob).size])).toEqual([
      ["https://s3/put-1", "image/jpeg", 100],
      ["https://s3/put-2", "image/jpeg", 10],
    ]);
    expect(registered()).toMatchObject({
      mediaId: "m1",
      mediaKey: "media/p-1/k1.jpg",
      thumbnailKey: "media/p-1/k2.jpg",
      filename: "IMG_0001.jpg",
      contentType: "image/jpeg",
      sizeBytes: 100,
    });
    expect(result.mediaId).toBe("m1");
  });

  it.each([
    ["an animated GIF", new File(["gif"], "loop.gif", { type: "image/gif" })],
    ["a video", new File(["mp4"], "clip.mp4", { type: "video/mp4" })],
  ])("uploads %s as it is without a thumbnail", async (_label, file) => {
    await upload(file);

    expect(resizeMocks.resizeImage).not.toHaveBeenCalled();
    expect(puts().map((call) => call.contentType)).toEqual([file.type]);
    expect(registered()).not.toHaveProperty("thumbnailKey");
    expect(registered()).toMatchObject({ filename: file.name, contentType: file.type });
  });

  it("falls back to the original file when the browser cannot shrink it", async () => {
    resizeMocks.resizeImage.mockRejectedValue(new Error("decode failed"));
    const file = new File(["original"], "photo.png", { type: "image/png" });

    await upload(file);

    expect(puts().map((call) => [call.contentType, call.body])).toEqual([["image/png", file]]);
    expect(registered()).not.toHaveProperty("thumbnailKey");
  });
});
