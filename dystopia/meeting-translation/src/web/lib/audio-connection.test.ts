import { describe, expect, it } from "vitest";

import { AudioConnectionState, reconnectDelay } from "./audio-connection.js";

describe("AudioConnectionState", () => {
  it("starts audio once after every joined connection while capture remains active", () => {
    const state = new AudioConnectionState();

    expect(state.startCapture()).toBe(false);
    expect(state.markJoined()).toBe(true);
    expect(state.markJoined()).toBe(false);
    expect(state.canSendAudio()).toBe(true);

    state.beginConnection();
    expect(state.canSendAudio()).toBe(false);
    expect(state.markJoined()).toBe(true);
    expect(state.markJoined()).toBe(false);
    expect(state.canSendAudio()).toBe(true);
  });

  it("does not restart audio after capture stops during a reconnect", () => {
    const state = new AudioConnectionState();

    state.startCapture();
    state.markJoined();
    state.beginConnection();

    expect(state.stopCapture()).toBe(false);
    expect(state.markJoined()).toBe(false);
    expect(state.canSendAudio()).toBe(false);
  });

  it("uses the bounded reconnect delay sequence before requiring manual reconnect", () => {
    expect(Array.from({ length: 6 }, (_, attempt) => reconnectDelay(attempt))).toEqual([
      250,
      500,
      1_000,
      2_000,
      4_000,
      undefined,
    ]);
  });
});
