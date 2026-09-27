import { resamplePcm16 } from "./pcm-resample.js";

const TARGET_SAMPLE_RATE = 16000;

let audioContext;
let workletNode;
let mediaStream;

export async function startMicrophone(onChunk) {
  mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  audioContext = new AudioContext();
  await audioContext.audioWorklet.addModule("./audio-worklet-processor.js");

  const source = audioContext.createMediaStreamSource(mediaStream);
  workletNode = new AudioWorkletNode(audioContext, "pcm-capture");
  workletNode.port.onmessage = (event) => {
    const input = new Int16Array(event.data);
    const resampled = resamplePcm16(input, audioContext.sampleRate, TARGET_SAMPLE_RATE);
    onChunk(new Uint8Array(resampled.buffer));
  };

  source.connect(workletNode);
}

export function stopMicrophone() {
  workletNode?.port.close();
  mediaStream?.getTracks().forEach((track) => track.stop());
  audioContext?.close();
  workletNode = undefined;
  mediaStream = undefined;
  audioContext = undefined;
}
