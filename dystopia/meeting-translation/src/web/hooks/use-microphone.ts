import { useCallback, useEffect, useRef, useState } from "react";

import pcmProcessorUrl from "../audio/pcm-processor.ts?worker&url";
import {
  initializeMicrophone,
  MicrophoneResourceOwner,
} from "../lib/microphone-session.js";

export type MicrophoneStatus = "idle" | "starting" | "active" | "microphone_unavailable";

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
  const resourcesRef = useRef<MicrophoneResourceOwner | undefined>(undefined);
  const callbacksRef = useRef({ onAudioStart, onAudioStop, onFrame });
  const activeRef = useRef(false);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState<MicrophoneStatus>("idle");

  callbacksRef.current = { onAudioStart, onAudioStop, onFrame };

  const stop = useCallback(async () => {
    const resources = resourcesRef.current;
    if (!resources) return;

    resourcesRef.current = undefined;
    if (activeRef.current) callbacksRef.current.onAudioStop();
    activeRef.current = false;
    try {
      await resources.dispose();
    } finally {
      if (mountedRef.current) setStatus("idle");
    }
  }, []);

  const start = useCallback(async () => {
    if (resourcesRef.current) return;

    // FALLBACK: manual text remains available when getUserMedia is denied or unavailable.
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("microphone_unavailable");
      return;
    }

    setStatus("starting");
    const resources = new MicrophoneResourceOwner();
    resourcesRef.current = resources;
    try {
      await initializeMicrophone(resources, {
        createAudioContext: () => new AudioContext(),
        createAudioWorkletNode: (context) => new AudioWorkletNode(context, "pcm-processor"),
        getUserMedia: () => navigator.mediaDevices.getUserMedia({ audio: true }),
        moduleUrl: pcmProcessorUrl,
      }, (frame) => callbacksRef.current.onFrame(frame));
      if (resourcesRef.current !== resources) return;
      activeRef.current = true;
      callbacksRef.current.onAudioStart();
      if (mountedRef.current) setStatus("active");
    } catch {
      activeRef.current = false;
      if (resourcesRef.current !== resources) return;
      resourcesRef.current = undefined;
      // FALLBACK: microphone permission failures leave manual captions available.
      if (mountedRef.current) setStatus("microphone_unavailable");
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const cleanup = () => {
      // SILENT: page lifecycle cleanup cannot display an asynchronous shutdown error.
      void stop().catch(() => undefined);
    };
    window.addEventListener("pagehide", cleanup);
    return () => {
      mountedRef.current = false;
      window.removeEventListener("pagehide", cleanup);
      cleanup();
    };
  }, [stop]);

  return { start, status, stop };
};
