import { describe, expect, it } from "vitest";

import { toPcm16 } from "./pcm.js";

describe("toPcm16", () => {
  it("encodes normalized samples as signed little-endian PCM", () => {
    expect([...new Uint8Array(toPcm16(new Float32Array([-1, 0, 1])))])
      .toEqual([0x00, 0x80, 0x00, 0x00, 0xff, 0x7f]);
  });

  it("clamps samples outside the normalized range", () => {
    expect([...new Uint8Array(toPcm16(new Float32Array([-2, 2])))])
      .toEqual([0x00, 0x80, 0xff, 0x7f]);
  });
});
