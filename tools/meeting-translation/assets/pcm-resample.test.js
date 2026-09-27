import test from "node:test";
import assert from "node:assert/strict";
import { resamplePcm16 } from "./pcm-resample.js";

test("downsamples a constant signal to half the length at half the rate", () => {
  const input = new Int16Array([100, 200, 300, 400]);
  const output = resamplePcm16(input, 48000, 24000);
  assert.equal(output.length, 2);
});

test("passes a signal through unchanged when rates match", () => {
  const input = new Int16Array([1, 2, 3]);
  const output = resamplePcm16(input, 16000, 16000);
  assert.deepEqual(Array.from(output), [1, 2, 3]);
});

test("clamps interpolated values to the Int16 range", () => {
  const input = new Int16Array([32767, -32768]);
  const output = resamplePcm16(input, 8000, 16000);
  for (const sample of output) {
    assert.ok(sample >= -32768 && sample <= 32767);
  }
});
