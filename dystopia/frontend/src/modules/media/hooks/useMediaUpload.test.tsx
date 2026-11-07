// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const resizeMocks = vi.hoisted(() => ({ resizeImage: vi.fn() }));
const videoMocks = vi.hoisted(() => ({ stripVideoMetadata: vi.fn() }));
const thumbnailMocks = vi.hoisted(() => ({ captureVideoThumbnail: vi.fn() }));

vi.mock("../lib/resize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/resize")>()),
  resizeImage: resizeMocks.resizeImage,
}));
vi.mock("../lib/video-metadata", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/video-metadata")>()),
  stripVideoMetadata: videoMocks.stripVideoMetadata,
}));
vi.mock("../lib/video-thumbnail", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/video-thumbnail")>()),
  captureVideoThumbnail: thumbnailMocks.captureVideoThumbnail,
}));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: Object.assign(() => null, { getState: () => ({ accountId: "a-1", activeProfileId: "p-1" }) }),
}));
vi.mock("@/lib/auth/profile-headers", () => ({ PROFILE_ID_HEADER: "x-profile-id", profileRequestHeaders: () => ({}) }));

const { useMediaUpload } = await import("./useMediaUpload");
const { AppError } = await import("@/lib/errors");

type Hook = ReturnType<typeof useMediaUpload>;
let hook: Hook | null = null;
function Probe() {
  hook = useMediaUpload();
  return null;
}

const calls: { url: string; method: string; body: unknown; contentType?: string }[] = [];
let issued = 0;
let failingPuts: string[] = [];
let failingIssue = 0;

beforeEach(async () => {
  calls.length = 0;
  issued = 0;
  failingPuts = [];
  failingIssue = 0;
  resizeMocks.resizeImage.mockReset().mockImplementation(async (_file: Blob, maxEdge: number) =>
    new Blob(["x".repeat(maxEdge === 640 ? 10 : 100)], { type: "image/jpeg" })
  );
  videoMocks.stripVideoMetadata.mockReset().mockImplementation(async (file: Blob) => new Blob(["stripped"], { type: file.type }));
  thumbnailMocks.captureVideoThumbnail.mockReset().mockResolvedValue(new Blob(["thumb"], { type: "image/jpeg" }));
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:local" }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: { method: string; body: unknown; headers?: Record<string, string> }) => {
      const body = typeof init.body === "string" ? JSON.parse(init.body) : init.body;
      calls.push({ url, method: init.method, body, contentType: init.headers?.["Content-Type"] });
      if (url === "/api/media/upload-url") {
        issued += 1;
        if (issued === failingIssue) return { ok: false, status: 500, json: async () => ({ error: "issue failed" }) };
        return { ok: true, json: async () => ({ uploadUrl: `https://s3/put-${issued}`, mediaKey: `media/p-1/k${issued}.jpg`, mediaId: `m${issued}` }) };
      }
      return { ok: !failingPuts.includes(url), json: async () => ({}) };
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
    expect(result.thumbnailLocalUrl).toBe("blob:local");
    expect(thumbnailMocks.captureVideoThumbnail).not.toHaveBeenCalled();
  });

  it.each([
    ["an animated GIF", new File(["gif"], "loop.gif", { type: "image/gif" })],
  ])("uploads %s as it is without a thumbnail", async (_label, file) => {
    const result = await upload(file);

    expect(resizeMocks.resizeImage).not.toHaveBeenCalled();
    expect(thumbnailMocks.captureVideoThumbnail).not.toHaveBeenCalled();
    expect(result).not.toHaveProperty("thumbnailLocalUrl");
    expect(puts().map((call) => call.contentType)).toEqual([file.type]);
    expect(registered()).not.toHaveProperty("thumbnailKey");
    expect(registered()).toMatchObject({ filename: file.name, contentType: file.type });
  });

  it("rejects without requesting an upload URL when the browser cannot shrink the photo", async () => {
    resizeMocks.resizeImage.mockRejectedValue(new Error("decode failed"));

    await expect(upload(new File(["original"], "photo.png", { type: "image/png" }))).rejects.toThrow(
      "画像を読み込めませんでした。別の画像を選んでください"
    );

    expect(calls).toEqual([]);
  });

  it("strips the metadata boxes of an MP4 before the upload", async () => {
    const stripped = new Blob(["stripped"], { type: "video/mp4" });
    videoMocks.stripVideoMetadata.mockResolvedValue(stripped);
    thumbnailMocks.captureVideoThumbnail.mockResolvedValue(null);
    const file = new File(["mp4"], "clip.mp4", { type: "video/mp4" });

    await upload(file);

    expect(videoMocks.stripVideoMetadata).toHaveBeenCalledWith(file);
    expect(puts().map((call) => [call.contentType, call.body])).toEqual([["video/mp4", stripped]]);
    expect(registered()).not.toHaveProperty("thumbnailKey");
    expect(registered()).toMatchObject({ filename: "clip.mp4", contentType: "video/mp4", sizeBytes: stripped.size });
  });

  it("rejects a video whose structure cannot be read", async () => {
    videoMocks.stripVideoMetadata.mockRejectedValue(new Error("bad structure"));

    await expect(upload(new File(["mp4"], "clip.mp4", { type: "video/mp4" }))).rejects.toThrow(
      "動画を読み込めませんでした。別の動画を選んでください"
    );

    expect(calls).toEqual([]);
  });

  it("reports the server's message as an AppError when no upload URL is issued", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 400, json: async () => ({ error: "このファイルは添付できません" }) })));

    const failure = upload(new File(["webm"], "clip.webm", { type: "video/webm" }));

    await expect(failure).rejects.toBeInstanceOf(AppError);
    await expect(failure).rejects.toThrow("このファイルは添付できません");
  });

  it("uploads a WebM video as it is", async () => {
    thumbnailMocks.captureVideoThumbnail.mockResolvedValue(null);
    const file = new File(["webm"], "clip.webm", { type: "video/webm" });

    await upload(file);

    expect(videoMocks.stripVideoMetadata).not.toHaveBeenCalled();
    expect(puts().map((call) => [call.contentType, call.body])).toEqual([["video/webm", file]]);
  });

  it("uploads a frame of the video as its JPEG thumbnail", async () => {
    const file = new File(["mp4"], "clip.mp4", { type: "video/mp4" });

    const result = await upload(file);

    expect(thumbnailMocks.captureVideoThumbnail).toHaveBeenCalledWith(file);
    expect(puts().map((call) => [call.contentType, (call.body as Blob).size])).toEqual([
      ["video/mp4", 8],
      ["image/jpeg", 5],
    ]);
    const issuedRequests = calls.filter((call) => call.url === "/api/media/upload-url").map((call) => call.body as Record<string, unknown>);
    expect(issuedRequests.map((body) => body.filename)).toEqual(["clip.mp4", "thumb-clip.jpg"]);
    expect(issuedRequests.map((body) => body.contentType)).toEqual(["video/mp4", "image/jpeg"]);
    expect(issuedRequests.map((body) => body.mediaType)).toEqual([2, 1]);
    expect(registered()).toMatchObject({ mediaKey: "media/p-1/k1.jpg", thumbnailKey: "media/p-1/k2.jpg", contentType: "video/mp4" });
    expect(result.thumbnailLocalUrl).toBe("blob:local");
  });

  it("cuts the frame from a WebM video too", async () => {
    const file = new File(["webm"], "clip.webm", { type: "video/webm" });

    await upload(file);

    expect(thumbnailMocks.captureVideoThumbnail).toHaveBeenCalledWith(file);
    expect(puts().map((call) => call.contentType)).toEqual(["video/webm", "image/jpeg"]);
    expect(registered()).toMatchObject({ thumbnailKey: "media/p-1/k2.jpg", contentType: "video/webm" });
  });

  it("registers the video without a thumbnail when no frame can be cut", async () => {
    thumbnailMocks.captureVideoThumbnail.mockResolvedValue(null);

    const result = await upload(new File(["mp4"], "clip.mp4", { type: "video/mp4" }));

    expect(puts()).toHaveLength(1);
    expect(registered()).not.toHaveProperty("thumbnailKey");
    expect(result).not.toHaveProperty("thumbnailLocalUrl");
  });

  it("registers the video without a thumbnail when the thumbnail upload fails", async () => {
    failingPuts = ["https://s3/put-2"];

    const result = await upload(new File(["mp4"], "clip.mp4", { type: "video/mp4" }));

    expect(registered()).not.toHaveProperty("thumbnailKey");
    expect(result).not.toHaveProperty("thumbnailLocalUrl");
  });

  it("registers the video without a thumbnail when no upload URL is issued for the thumbnail", async () => {
    failingIssue = 2;

    const result = await upload(new File(["mp4"], "clip.mp4", { type: "video/mp4" }));

    expect(puts()).toHaveLength(1);
    expect(registered()).not.toHaveProperty("thumbnailKey");
    expect(result).not.toHaveProperty("thumbnailLocalUrl");
  });

  it("still rejects a video whose own upload fails", async () => {
    failingPuts = ["https://s3/put-1"];

    await expect(upload(new File(["mp4"], "clip.mp4", { type: "video/mp4" }))).rejects.toThrow("ファイルのアップロードに失敗しました");
  });

  it("still rejects a photo whose thumbnail upload fails", async () => {
    failingPuts = ["https://s3/put-2"];

    await expect(upload(new File(["x"], "photo.png", { type: "image/png" }))).rejects.toThrow("ファイルのアップロードに失敗しました");
  });
});
