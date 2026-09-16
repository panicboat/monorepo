import { describe, expect, it } from "vitest";

import { StreamingPcmResampler } from "./pcm-resampler.js";

describe("StreamingPcmResampler", () => {
  it("preserves the source position across 128-sample render quanta", () => {
    const resampler = new StreamingPcmResampler(48_000);
    const frames: Float32Array[] = [];

    for (let quantum = 0; quantum < 16; quantum += 1) {
      const input = Float32Array.from(
        { length: 128 },
        (_, offset) => quantum * 128 + offset,
      );
      frames.push(...resampler.push(input));
    }

    expect(frames).toHaveLength(2);
    expect(frames[0]).toHaveLength(320);
    expect([...frames[0].slice(0, 4)]).toEqual([0, 3, 6, 9]);
    expect([...frames[0].slice(-3)]).toEqual([951, 954, 957]);
    expect(frames[1]).toHaveLength(320);
    expect([...frames[1].slice(0, 4)]).toEqual([960, 963, 966, 969]);
    expect([...frames[1].slice(-3)]).toEqual([1_911, 1_914, 1_917]);
  });

  it("interpolates continuously when the source rate is not an integer multiple of 16 kHz", () => {
    const resampler = new StreamingPcmResampler(44_100);
    const frames: Float32Array[] = [];

    for (let quantum = 0; quantum < 8; quantum += 1) {
      frames.push(...resampler.push(Float32Array.from(
        { length: 128 },
        (_, offset) => quantum * 128 + offset,
      )));
    }

    expect(frames).toHaveLength(1);
    expect(frames[0]).toHaveLength(320);
    expect(frames[0][1]).toBeCloseTo(2.75625, 5);
    expect(frames[0][319]).toBeCloseTo(879.24375, 4);
  });
});
