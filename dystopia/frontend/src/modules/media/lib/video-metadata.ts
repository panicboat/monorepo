const STRIPPABLE_TYPES = new Set(["video/mp4", "video/quicktime"]);
// Rewritten in place because removing a box would shift the stco/co64 chunk offsets.
const FREE = [0x66, 0x72, 0x65, 0x65];
const HEADER_PROBE_BYTES = 16;

type BoxHeader = { type: string; headerSize: number; size: number };

export function isStrippableVideo(type: string): boolean {
  return STRIPPABLE_TYPES.has(type);
}

function readHeader(bytes: Uint8Array, offset: number, end: number): BoxHeader {
  if (end - offset < 8) throw new Error("truncated box header");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let size = view.getUint32(offset);
  let headerSize = 8;
  const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
  if (size === 1) {
    if (end - offset < 16) throw new Error("truncated box header");
    const large = view.getBigUint64(offset + 8);
    if (large > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("box too large");
    size = Number(large);
    headerSize = 16;
  } else if (size === 0) {
    size = end - offset;
  }
  if (size < headerSize || offset + size > end) throw new Error("box overruns its parent");
  return { type, headerSize, size };
}

function neutralizeChildren(moov: Uint8Array, start: number, end: number): void {
  let offset = start;
  while (offset < end) {
    const { type, headerSize, size } = readHeader(moov, offset, end);
    if (type === "udta" || type === "meta") {
      moov.set(FREE, offset + 4);
    } else if (type === "trak") {
      neutralizeChildren(moov, offset + headerSize, offset + size);
    }
    offset += size;
  }
}

export async function stripVideoMetadata(file: Blob): Promise<Blob> {
  let offset = 0;
  while (offset < file.size) {
    const probe = new Uint8Array(await file.slice(offset, offset + HEADER_PROBE_BYTES).arrayBuffer());
    const { type, size } = readHeader(probe, 0, file.size - offset);
    if (type === "moov") {
      const moovEnd = offset + size;
      const moov = new Uint8Array(await file.slice(offset, moovEnd).arrayBuffer());
      const { headerSize } = readHeader(moov, 0, moov.length);
      neutralizeChildren(moov, headerSize, moov.length);
      return new Blob([file.slice(0, offset), moov as BlobPart, file.slice(moovEnd)], { type: file.type });
    }
    offset += size;
  }
  throw new Error("moov box not found");
}
