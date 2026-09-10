import { useCallback, useEffect, useRef, useState } from "react";

export type MicrophoneStatus = "idle" | "starting" | "active" | "microphone_unavailable";

interface MicrophoneResources {
  context: AudioContext;
  node: AudioWorkletNode;
  source: MediaStreamAudioSourceNode;
  stream: MediaStream;
}

interface UseMicrophoneOptions {
  onAudioStart: () => void;
  onAudioStop: () => void;
  onFrame: (frame: Float32Array) => void;
}

export interface MicrophoneControls {
  start: () => Promise<void>;
  status: MicrophoneStatus;
  stop: () => Promise<void>;
}

export const useMicrophone = ({ onAudioStart, onAudioStop, onFrame }: UseMicrophoneOptions): MicrophoneControls => {
  const resourcesRef = useRef<MicrophoneResources | undefined>(undefined);
  const callbacksRef = useRef({ onAudioStart, onAudioStop, onFrame });
  const [status, setStatus] = useState<MicrophoneStatus>("idle");

  callbacksRef.current = { onAudioStart, onAudioStop, onFrame };

  const stop = useCallback(async () => {
    const resources = resourcesRef.current;
    if (!resources) return;

    resourcesRef.current = undefined;
    callbacksRef.current.onAudioStop();
    resources.node.port.onmessage = null;
    resources.node.disconnect();
    resources.source.disconnect();
    resources.stream.getTracks().forEach((track) => track.stop());
    await resources.context.close();
    setStatus("idle");
  }, []);

  const start = useCallback(async () => {
    if (resourcesRef.current || status === "starting") return;

    // FALLBACK: manual text remains available when getUserMedia is denied or unavailable.
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("microphone_unavailable");
      return;
    }

    setStatus("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const context = new AudioContext();
      await context.audioWorklet.addModule(new URL("../audio/pcm-processor.ts", import.meta.url));
      const source = context.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(context, "pcm-processor");
      node.port.onmessage = (event: MessageEvent<Float32Array>) => callbacksRef.current.onFrame(event.data);
      source.connect(node);
      node.connect(context.destination);
      resourcesRef.current = { context, node, source, stream };
      callbacksRef.current.onAudioStart();
      setStatus("active");
    } catch {
      // FALLBACK: microphone permission failures leave manual captions available.
      setStatus("microphone_unavailable");
    }
  }, [status]);

  useEffect(() => {
    const cleanup = () => {
      // SILENT: page lifecycle cleanup cannot display an asynchronous shutdown error.
      void stop().catch(() => undefined);
    };
    window.addEventListener("pagehide", cleanup);
    return () => {
      window.removeEventListener("pagehide", cleanup);
      cleanup();
    };
  }, [stop]);

  return { start, status, stop };
};
