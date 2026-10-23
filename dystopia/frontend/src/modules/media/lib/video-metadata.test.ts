import { describe, expect, it } from "vitest";
import { isStrippableVideo, stripVideoMetadata } from "./video-metadata";

const encoder = new TextEncoder();

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function u32(value: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value);
  return out;
}

function type4(type: string): Uint8Array {
  const bytes = new Uint8Array(4);
  for (let i = 0; i < 4; i += 1) bytes[i] = type.charCodeAt(i);
  return bytes;
}

function box(type: string, ...payload: Uint8Array[]): Uint8Array {
  const body = concat(payload);
  return concat([u32(8 + body.length), type4(type), body]);
}

function bytesOf(blob: Blob): Promise<Uint8Array> {
  return blob.arrayBuffer().then((buffer) => new Uint8Array(buffer));
}

function video(...parts: Uint8Array[]): Blob {
  return new Blob([concat(parts) as BlobPart], { type: "video/mp4" });
}

describe("stripVideoMetadata", () => {
  it("rewrites udta and meta under moov and trak to free", async () => {
    const ftyp = box("ftyp", encoder.encode("isom"));
    const mvhd = box("mvhd", new Uint8Array(8));
    const moovUdta = box("udta", box("©xyz", encoder.encode("+35.0+139.0/")));
    const moovMeta = box("meta", new Uint8Array(12));
    const tkhd = box("tkhd", new Uint8Array(8));
    const trakUdta = box("udta", encoder.encode("model"));
    const mdia = box("mdia", box("mdhd", new Uint8Array(8)));
    const trak = box("trak", tkhd, trakUdta, mdia);
    const moov = box("moov", mvhd, moovUdta, moovMeta, trak);
    const mdat = box("mdat", encoder.encode("frame data"));
    const original = concat([ftyp, moov, mdat]);

    const result = await stripVideoMetadata(video(ftyp, moov, mdat));
    const bytes = await bytesOf(result);

    const expected = original.slice();
    for (const child of [moovUdta, moovMeta, trakUdta]) {
      expected.set(type4("free"), indexOf(original, child, ftyp.length) + 4);
    }

    expect(result.size).toBe(original.length);
    expect(result.type).toBe("video/mp4");
    expect(Array.from(bytes)).toEqual(Array.from(expected));
    expect(typeAt(bytes, indexOf(original, moovUdta, 0))).toBe("free");
    expect(typeAt(bytes, indexOf(original, moovMeta, 0))).toBe("free");
    expect(typeAt(bytes, indexOf(original, trakUdta, 0))).toBe("free");
    for (const kept of [mvhd, tkhd, mdia, mdat, trak]) {
      const at = indexOf(original, kept, 0);
      expect(Array.from(bytes.slice(at, at + 8))).toEqual(Array.from(kept.slice(0, 8)));
    }
  });

  it("finds moov after a 64-bit mdat", async () => {
    const ftyp = box("ftyp", encoder.encode("isom"));
    const payload = encoder.encode("frame data");
    const largeSize = new Uint8Array(8);
    new DataView(largeSize.buffer).setBigUint64(0, BigInt(16 + payload.length));
    const mdat = concat([u32(1), type4("mdat"), largeSize, payload]);
    const udta = box("udta", encoder.encode("x"));
    const moov = box("moov", udta);

    const bytes = await bytesOf(await stripVideoMetadata(video(ftyp, mdat, moov)));

    const udtaAt = ftyp.length + mdat.length + 8;
    expect(typeAt(bytes, udtaAt)).toBe("free");
  });

  it("treats a zero-size last box as running to the end", async () => {
    const ftyp = box("ftyp", encoder.encode("isom"));
    const udta = box("udta", encoder.encode("x"));
    const moov = box("moov", udta);
    const mdat = concat([u32(0), type4("mdat"), encoder.encode("frame data")]);

    const result = await stripVideoMetadata(video(ftyp, moov, mdat));
    const bytes = await bytesOf(result);

    expect(typeAt(bytes, ftyp.length + 8)).toBe("free");
    expect(result.size).toBe(ftyp.length + moov.length + mdat.length);
  });

  it("rejects a file without moov", async () => {
    const ftyp = box("ftyp", encoder.encode("isom"));
    const mdat = box("mdat", encoder.encode("frame data"));

    await expect(stripVideoMetadata(video(ftyp, mdat))).rejects.toThrow();
  });

  it("rejects a box that overruns its parent while staying inside the file", async () => {
    const ftyp = box("ftyp", encoder.encode("isom"));
    const overrun = concat([u32(64), type4("udta"), new Uint8Array(4)]);
    const moov = box("moov", overrun);
    const mdat = box("mdat", new Uint8Array(100));

    await expect(stripVideoMetadata(video(ftyp, moov, mdat))).rejects.toThrow();
  });

  it("rewrites udta under a moov that uses a 64-bit size", async () => {
    const ftyp = box("ftyp", encoder.encode("isom"));
    const udta = box("udta", encoder.encode("x"));
    const largeSize = new Uint8Array(8);
    new DataView(largeSize.buffer).setBigUint64(0, BigInt(16 + udta.length));
    const moov = concat([u32(1), type4("moov"), largeSize, udta]);

    const bytes = await bytesOf(await stripVideoMetadata(video(ftyp, moov)));

    expect(typeAt(bytes, ftyp.length + 16)).toBe("free");
  });

  it("stops at a zero terminator that ends moov", async () => {
    const ftyp = box("ftyp", encoder.encode("isom"));
    const udta = box("udta", encoder.encode("x"));
    const moov = concat([u32(8 + udta.length + 4), type4("moov"), udta, new Uint8Array(4)]);

    const result = await stripVideoMetadata(video(ftyp, moov));
    const bytes = await bytesOf(result);

    expect(typeAt(bytes, ftyp.length + 8)).toBe("free");
    expect(result.size).toBe(ftyp.length + moov.length);
  });

  it("rejects a short remainder in moov that is not a zero terminator", async () => {
    const ftyp = box("ftyp", encoder.encode("isom"));
    const udta = box("udta", encoder.encode("x"));
    const moov = concat([u32(8 + udta.length + 4), type4("moov"), udta, new Uint8Array([0, 0, 0, 1])]);

    await expect(stripVideoMetadata(video(ftyp, moov))).rejects.toThrow();
  });
});

describe("isStrippableVideo", () => {
  it.each([
    ["video/mp4", true],
    ["video/quicktime", true],
    ["video/3gpp", true],
    ["video/3gpp2", true],
    ["video/x-m4v", true],
    ["video/webm", false],
    ["image/jpeg", false],
  ])("treats %s as strippable: %s", (type, expected) => {
    expect(isStrippableVideo(type)).toBe(expected);
  });
});

function typeAt(bytes: Uint8Array, boxStart: number): string {
  return String.fromCharCode(...bytes.slice(boxStart + 4, boxStart + 8));
}

function indexOf(haystack: Uint8Array, needle: Uint8Array, from: number): number {
  outer: for (let i = from; i <= haystack.length - needle.length; i += 1) {
    for (let j = 0; j < needle.length; j += 1) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  throw new Error("needle not found");
}
