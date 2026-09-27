import test from "node:test";
import assert from "node:assert/strict";
import { resamplePcm16 } from "./pcm-resample.js";

test("downsamples a ramp signal to half the length at half the rate", () => {
  const input = new Int16Array([100, 200, 300, 400]);
  const output = resamplePcm16(input, 48000, 24000);
  assert.equal(output.length, 2);
});

test("passes a signal through unchanged when rates match", () => {
  const input = new Int16Array([1, 2, 3]);
  const output = resamplePcm16(input, 16000, 16000);
  assert.deepEqual(Array.from(output), [1, 2, 3]);
});

test("saturates out-of-range input instead of letting it wrap", () => {
  // A real Int16Array can't hold out-of-range values, so this passes a plain array to force the clamp path.
  const outOfRange = [40000, 40000];
  const output = resamplePcm16(outOfRange, 8000, 16000);
  for (const sample of output) {
    assert.equal(sample, 32767);
  }
});
