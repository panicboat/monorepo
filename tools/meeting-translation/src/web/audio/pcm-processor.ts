import { StreamingPcmResampler } from "../lib/pcm-resampler.js";

declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}

declare const sampleRate: number;

declare const registerProcessor: (name: string, processor: typeof AudioWorkletProcessor) => void;

class PcmProcessor extends AudioWorkletProcessor {
  private readonly resampler = new StreamingPcmResampler(sampleRate);

  process(inputs: Float32Array[][]): boolean {
    const channels = inputs[0];
    if (!channels?.length) return true;

    const sampleCount = channels[0]?.length ?? 0;
    const mono = new Float32Array(sampleCount);
    for (let index = 0; index < sampleCount; index += 1) {
      let value = 0;
      for (const channel of channels) value += channel[index] ?? 0;
      mono[index] = value / channels.length;
    }

    for (const frame of this.resampler.push(mono)) this.port.postMessage(frame);
    return true;
  }
}

registerProcessor("pcm-processor", PcmProcessor);
