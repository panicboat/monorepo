// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ resizeImage: vi.fn(), authFetch: vi.fn() }));

vi.mock("@/modules/media/lib/resize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/media/lib/resize")>()),
  resizeImage: mocks.resizeImage,
}));
vi.mock("@/lib/auth/fetch", () => ({ authFetch: mocks.authFetch }));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: Object.assign(() => null, { getState: () => ({ activeProfileId: "p-1" }) }),
}));

const { MAIN_MAX_EDGE, MAIN_QUALITY } = await import("@/modules/media/lib/resize");
const { useMediaUpload } = await import("./useMediaUpload");

type Hook = ReturnType<typeof useMediaUpload>;
let hook: Hook | null = null;
function Probe() {
  hook = useMediaUpload();
  return null;
}

const puts: { url: string; contentType?: string; body: unknown }[] = [];

beforeEach(async () => {
  puts.length = 0;
  mocks.resizeImage.mockReset().mockImplementation(async () => new Blob(["shrunk"], { type: "image/jpeg" }));
  mocks.authFetch.mockReset().mockImplementation(async (url: string) =>
    url === "/api/media/upload-url"
      ? { uploadUrl: "https://s3/put-1", mediaKey: "media/p-1/k1.jpg", mediaId: "m1" }
      : { media: { id: "m1", url: "https://cdn/m1.jpg" } }
  );
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:local" }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: { headers?: Record<string, string>; body: unknown }) => {
      puts.push({ url, contentType: init.headers?.["Content-Type"], body: init.body });
      return { ok: true };
    })
  );
  await act(async () => createRoot(document.createElement("div")).render(createElement(Probe)));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const upload = async (file: File) => {
  let result: Awaited<ReturnType<Hook["upload"]>> | undefined;
  await act(async () => {
    result = await hook!.upload(file);
  });
  return result!;
};

const requestBody = (url: string) => mocks.authFetch.mock.calls.find((call) => call[0] === url)![1].body as Record<string, unknown>;

describe("useMediaUpload (profile)", () => {
  it("re-encodes a photo before the upload", async () => {
    const shrunk = new Blob(["shrunk"], { type: "image/jpeg" });
    mocks.resizeImage.mockResolvedValue(shrunk);
    const file = new File(["original"], "avatar.heic", { type: "image/heic" });

    const result = await upload(file);

    expect(mocks.resizeImage).toHaveBeenCalledWith(file, MAIN_MAX_EDGE, MAIN_QUALITY);
    expect(requestBody("/api/media/upload-url")).toMatchObject({ filename: "avatar.jpg", contentType: "image/jpeg" });
    expect(puts).toEqual([{ url: "https://s3/put-1", contentType: "image/jpeg", body: shrunk }]);
    expect(requestBody("/api/media/register")).toMatchObject({ filename: "avatar.jpg", contentType: "image/jpeg", sizeBytes: shrunk.size });
    expect(result).toEqual({ mediaId: "m1", url: "https://cdn/m1.jpg" });
  });

  it("reports an error when the photo cannot be re-encoded", async () => {
    mocks.resizeImage.mockRejectedValue(new Error("decode failed"));

    const result = await upload(new File(["original"], "avatar.png", { type: "image/png" }));

    expect(result).toBeNull();
    expect(hook!.error).toBe("画像を読み込めませんでした。別の画像を選んでください");
    expect(mocks.authFetch).not.toHaveBeenCalled();
    expect(puts).toEqual([]);
  });

  it("uploads a GIF as it is", async () => {
    const file = new File(["gif"], "loop.gif", { type: "image/gif" });

    await upload(file);

    expect(mocks.resizeImage).not.toHaveBeenCalled();
    expect(requestBody("/api/media/upload-url")).toMatchObject({ filename: "loop.gif", contentType: "image/gif" });
    expect(puts).toEqual([{ url: "https://s3/put-1", contentType: "image/gif", body: file }]);
  });
});
