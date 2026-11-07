// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi, type Mock, type MockInstance } from "vitest";
import { THUMBNAIL_QUALITY } from "./resize";
import { CAPTURE_TIMEOUT_MS, captureVideoThumbnail, REDRAW_INTERVAL_MS, thumbnailTime, videoSrcWithFrame } from "./video-thumbnail";

describe("thumbnailTime", () => {
  it.each([
    [30, 10],
    [10, 10],
    [6, 3],
    [0, 0],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
    [-1, 0],
  ])("cuts a %s second video at %s seconds", (duration, expected) => {
    expect(thumbnailTime(duration)).toBe(expected);
  });
});

describe("videoSrcWithFrame", () => {
  it("asks the browser to draw the frame at 0.1 seconds", () => {
    expect(videoSrcWithFrame("https://s3/clip.mp4?X-Amz-Signature=abc")).toBe("https://s3/clip.mp4?X-Amz-Signature=abc#t=0.1");
  });
});

describe("captureVideoThumbnail", () => {
  const mp4 = (body: string) => new Blob([body], { type: "video/mp4" });
  let createObjectURL: MockInstance<typeof URL.createObjectURL>;
  let revokeObjectURL: MockInstance<typeof URL.revokeObjectURL>;
  let createElement: MockInstance<typeof document.createElement>;
  let load: MockInstance<HTMLMediaElement["load"]>;
  let drawImage: Mock<CanvasRenderingContext2D["drawImage"]>;
  let getImageData: Mock<(x: number, y: number, width: number, height: number) => { data: Uint8ClampedArray }>;
  let toBlob: MockInstance<HTMLCanvasElement["toBlob"]>;

  const videoAt = (index: number) => {
    const videos = createElement.mock.results.filter((_, call) => createElement.mock.calls[call][0] === "video");
    return videos[index].value as HTMLVideoElement;
  };

  const pixel = (alpha: number) => ({ data: new Uint8ClampedArray([0, 0, 0, alpha]) });

  const decodable = (video: HTMLVideoElement, size: { duration: number; width: number; height: number }) => {
    Object.defineProperties(video, {
      duration: { value: size.duration },
      videoWidth: { value: size.width },
      videoHeight: { value: size.height },
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    let issued = 0;
    createObjectURL = vi.spyOn(URL, "createObjectURL").mockImplementation(() => `blob:local/${++issued}`);
    revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    createElement = vi.spyOn(document, "createElement");
    load = vi.spyOn(HTMLMediaElement.prototype, "load");
    drawImage = vi.fn<CanvasRenderingContext2D["drawImage"]>();
    getImageData = vi.fn(() => pixel(255));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      (() => ({ drawImage, getImageData })) as unknown as HTMLCanvasElement["getContext"],
    );
    toBlob = vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => callback(new Blob(["jpeg"], { type: "image/jpeg" })));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("gives up with null when the video never becomes drawable", async () => {
    const result = captureVideoThumbnail(mp4("mp4"));
    await vi.advanceTimersByTimeAsync(CAPTURE_TIMEOUT_MS);
    await expect(result).resolves.toBeNull();
  });

  it("starts the next capture only after the previous one settles", async () => {
    const first = captureVideoThumbnail(mp4("a"));
    const second = captureVideoThumbnail(mp4("b"));
    await vi.advanceTimersByTimeAsync(0);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(CAPTURE_TIMEOUT_MS);
    expect(createObjectURL).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(CAPTURE_TIMEOUT_MS);
    await expect(Promise.all([first, second])).resolves.toEqual([null, null]);
  });

  it("releases the object URL after giving up", async () => {
    const result = captureVideoThumbnail(mp4("mp4"));
    await vi.advanceTimersByTimeAsync(0);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(CAPTURE_TIMEOUT_MS);
    await result;
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith(createObjectURL.mock.results[0].value);
  });

  it("lets the decoder go after giving up", async () => {
    const result = captureVideoThumbnail(mp4("mp4"));
    await vi.advanceTimersByTimeAsync(CAPTURE_TIMEOUT_MS);
    await result;
    expect(videoAt(0).hasAttribute("src")).toBe(false);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("loads the file in a silent inline video that preloads", async () => {
    const result = captureVideoThumbnail(mp4("mp4"));
    await vi.advanceTimersByTimeAsync(0);
    const video = videoAt(0);
    expect(video.getAttribute("src")).toBe(createObjectURL.mock.results[0].value);
    expect(video.muted).toBe(true);
    expect(video.playsInline).toBe(true);
    expect(video.preload).toBe("auto");
    await vi.advanceTimersByTimeAsync(CAPTURE_TIMEOUT_MS);
    await result;
  });

  it("starts loading the file right after setting it as the source", async () => {
    const sources: (string | null)[] = [];
    load.mockImplementation(function (this: HTMLMediaElement) {
      sources.push(this.getAttribute("src"));
    });
    const result = captureVideoThumbnail(mp4("mp4"));
    await vi.advanceTimersByTimeAsync(0);
    expect(sources).toEqual([createObjectURL.mock.results[0].value]);
    await vi.advanceTimersByTimeAsync(CAPTURE_TIMEOUT_MS);
    await result;
  });

  it("seeks to the cut position once the metadata is known", async () => {
    const result = captureVideoThumbnail(mp4("mp4"));
    await vi.advanceTimersByTimeAsync(0);
    const video = videoAt(0);
    decodable(video, { duration: 30, width: 1920, height: 1080 });
    video.dispatchEvent(new Event("loadedmetadata"));
    expect(video.currentTime).toBe(10);
    await vi.advanceTimersByTimeAsync(CAPTURE_TIMEOUT_MS);
    await result;
  });

  it("draws the sought frame into a canvas scaled to the thumbnail size and encodes it as JPEG", async () => {
    const encoded = new Blob(["jpeg"], { type: "image/jpeg" });
    toBlob.mockImplementation((callback) => callback(encoded));
    const result = captureVideoThumbnail(mp4("mp4"));
    await vi.advanceTimersByTimeAsync(0);
    const video = videoAt(0);
    decodable(video, { duration: 30, width: 1920, height: 1080 });
    video.dispatchEvent(new Event("loadedmetadata"));
    video.dispatchEvent(new Event("seeked"));
    await expect(result).resolves.toBe(encoded);
    expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 640, 360);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", THUMBNAIL_QUALITY);
    const canvas = toBlob.mock.contexts[0] as HTMLCanvasElement;
    expect([canvas.width, canvas.height]).toEqual([640, 360]);
  });

  it("draws the frame again when the canvas is still empty after drawing", async () => {
    const encoded = new Blob(["jpeg"], { type: "image/jpeg" });
    toBlob.mockImplementation((callback) => callback(encoded));
    getImageData.mockReturnValueOnce(pixel(0));
    const result = captureVideoThumbnail(mp4("mp4"));
    await vi.advanceTimersByTimeAsync(0);
    const video = videoAt(0);
    decodable(video, { duration: 30, width: 1920, height: 1080 });
    video.dispatchEvent(new Event("loadedmetadata"));
    video.dispatchEvent(new Event("seeked"));
    expect(toBlob).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(REDRAW_INTERVAL_MS);
    await expect(result).resolves.toBe(encoded);
    expect(drawImage).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("gives up with null instead of an empty image when the canvas stays empty", async () => {
    getImageData.mockReturnValue(pixel(0));
    const result = captureVideoThumbnail(mp4("mp4"));
    await vi.advanceTimersByTimeAsync(0);
    const video = videoAt(0);
    decodable(video, { duration: 30, width: 1920, height: 1080 });
    video.dispatchEvent(new Event("loadedmetadata"));
    video.dispatchEvent(new Event("seeked"));
    await vi.advanceTimersByTimeAsync(CAPTURE_TIMEOUT_MS);
    await expect(result).resolves.toBeNull();
    expect(toBlob).not.toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("releases the object URL and the decoder after a successful cut", async () => {
    const result = captureVideoThumbnail(mp4("mp4"));
    await vi.advanceTimersByTimeAsync(0);
    const video = videoAt(0);
    decodable(video, { duration: 30, width: 1920, height: 1080 });
    video.dispatchEvent(new Event("loadedmetadata"));
    video.dispatchEvent(new Event("seeked"));
    await result;
    expect(revokeObjectURL).toHaveBeenCalledWith(createObjectURL.mock.results[0].value);
    expect(video.hasAttribute("src")).toBe(false);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("stops the timeout once the cut succeeds", async () => {
    const result = captureVideoThumbnail(mp4("mp4"));
    await vi.advanceTimersByTimeAsync(0);
    const video = videoAt(0);
    decodable(video, { duration: 30, width: 1920, height: 1080 });
    video.dispatchEvent(new Event("loadedmetadata"));
    video.dispatchEvent(new Event("seeked"));
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ignores a late seek after giving up", async () => {
    const result = captureVideoThumbnail(mp4("mp4"));
    await vi.advanceTimersByTimeAsync(0);
    const video = videoAt(0);
    decodable(video, { duration: 30, width: 1920, height: 1080 });
    await vi.advanceTimersByTimeAsync(CAPTURE_TIMEOUT_MS);
    await result;
    video.dispatchEvent(new Event("seeked"));
    expect(drawImage).not.toHaveBeenCalled();
  });

  it("gives up with null when the video fails to decode", async () => {
    const result = captureVideoThumbnail(mp4("mp4"));
    await vi.advanceTimersByTimeAsync(0);
    videoAt(0).dispatchEvent(new Event("error"));
    await expect(result).resolves.toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("gives up with null when the canvas has no 2D context", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => null) as unknown as HTMLCanvasElement["getContext"]);
    const result = captureVideoThumbnail(mp4("mp4"));
    await vi.advanceTimersByTimeAsync(0);
    const video = videoAt(0);
    decodable(video, { duration: 30, width: 1920, height: 1080 });
    video.dispatchEvent(new Event("loadedmetadata"));
    video.dispatchEvent(new Event("seeked"));
    await expect(result).resolves.toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it("gives up with null when the canvas cannot encode the frame", async () => {
    toBlob.mockImplementation((callback) => callback(null));
    const result = captureVideoThumbnail(mp4("mp4"));
    await vi.advanceTimersByTimeAsync(0);
    const video = videoAt(0);
    decodable(video, { duration: 30, width: 1920, height: 1080 });
    video.dispatchEvent(new Event("loadedmetadata"));
    video.dispatchEvent(new Event("seeked"));
    await expect(result).resolves.toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it("gives up with null when drawing throws", async () => {
    drawImage.mockImplementation(() => {
      throw new Error("tainted canvas");
    });
    const result = captureVideoThumbnail(mp4("mp4"));
    await vi.advanceTimersByTimeAsync(0);
    const video = videoAt(0);
    decodable(video, { duration: 30, width: 1920, height: 1080 });
    video.dispatchEvent(new Event("loadedmetadata"));
    video.dispatchEvent(new Event("seeked"));
    await expect(result).resolves.toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it("still runs the next capture after one fails unexpectedly", async () => {
    createObjectURL.mockImplementationOnce(() => {
      throw new Error("out of memory");
    });
    const first = captureVideoThumbnail(mp4("a"));
    const second = captureVideoThumbnail(mp4("b"));
    await expect(first).resolves.toBeNull();
    await vi.advanceTimersByTimeAsync(0);
    expect(createObjectURL).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(CAPTURE_TIMEOUT_MS);
    await expect(second).resolves.toBeNull();
  });
});
