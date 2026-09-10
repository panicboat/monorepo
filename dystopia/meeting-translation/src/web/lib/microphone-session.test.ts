import { describe, expect, it } from "vitest";

import {
  MicrophoneResourceOwner,
  initializeMicrophone,
  type MicrophoneDependencies,
} from "./microphone-session.js";

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
};

const createFakes = (failure?: "addModule" | "node" | "connect") => {
  const calls: string[] = [];
  const track = { stop: () => calls.push("track.stop") };
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  const source = {
    connect: () => calls.push("source.connect"),
    disconnect: () => calls.push("source.disconnect"),
  } as unknown as MediaStreamAudioSourceNode;
  const node = {
    connect: () => {
      calls.push("node.connect");
      if (failure === "connect") throw new Error("connect failed");
    },
    disconnect: () => calls.push("node.disconnect"),
    port: { onmessage: undefined },
  } as unknown as AudioWorkletNode;
  const context = {
    audioWorklet: {
      addModule: async () => {
        calls.push("addModule");
        if (failure === "addModule") throw new Error("addModule failed");
      },
    },
    close: async () => { calls.push("context.close"); },
    createMediaStreamSource: () => {
      calls.push("createSource");
      return source;
    },
    destination: {},
  } as unknown as AudioContext;
  const dependencies: MicrophoneDependencies = {
    createAudioContext: () => {
      calls.push("createContext");
      return context;
    },
    createAudioWorkletNode: () => {
      calls.push("createNode");
      if (failure === "node") throw new Error("node failed");
      return node;
    },
    getUserMedia: async () => {
      calls.push("getUserMedia");
      return stream;
    },
    moduleUrl: new URL("https://example.test/pcm-processor.js"),
  };

  return { calls, context, dependencies, node, source, stream };
};

describe("initializeMicrophone", () => {
  it.each(["addModule", "node", "connect"] as const)(
    "releases every acquired resource when %s fails",
    async (failure) => {
      const fakes = createFakes(failure);
      const owner = new MicrophoneResourceOwner();

      await expect(initializeMicrophone(owner, fakes.dependencies, () => undefined)).rejects.toThrow();

      expect(fakes.calls).toContain("track.stop");
      expect(fakes.calls).toContain("context.close");
      if (failure !== "addModule") expect(fakes.calls).toContain("source.disconnect");
      if (failure === "connect") expect(fakes.calls).toContain("node.disconnect");
    },
  );

  it("stops a stream that arrives after initialization is cancelled", async () => {
    const streamResult = deferred<MediaStream>();
    const fakes = createFakes();
    fakes.dependencies.getUserMedia = () => streamResult.promise;
    const owner = new MicrophoneResourceOwner();
    const completion = initializeMicrophone(owner, fakes.dependencies, () => undefined);

    await owner.dispose();
    streamResult.resolve(fakes.stream);

    await expect(completion).rejects.toThrow("cancelled");
    expect(fakes.calls).toContain("track.stop");
    expect(fakes.calls).not.toContain("createContext");
  });

  it("closes acquired resources when cancelled while addModule is pending", async () => {
    const moduleResult = deferred<void>();
    const fakes = createFakes();
    (fakes.context.audioWorklet.addModule as unknown as () => Promise<void>) = () => moduleResult.promise;
    const owner = new MicrophoneResourceOwner();
    const completion = initializeMicrophone(owner, fakes.dependencies, () => undefined);
    await Promise.resolve();

    await owner.dispose();
    moduleResult.resolve();

    await expect(completion).rejects.toThrow("cancelled");
    expect(fakes.calls).toContain("track.stop");
    expect(fakes.calls).toContain("context.close");
    expect(fakes.calls).not.toContain("createSource");
  });
});
