declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}

declare const sampleRate: number;

declare const registerProcessor: (name: string, processor: typeof AudioWorkletProcessor) => void;

class PcmProcessor extends AudioWorkletProcessor {
  private sourceSamples: number[] = [];
  private sourcePosition = 0;
  private outputSamples: number[] = [];

  process(inputs: Float32Array[][]): boolean {
    const channels = inputs[0];
    if (!channels?.length) return true;

    const sampleCount = channels[0]?.length ?? 0;
    for (let index = 0; index < sampleCount; index += 1) {
      let value = 0;
      for (const channel of channels) value += channel[index] ?? 0;
      this.sourceSamples.push(value / channels.length);
    }

    const step = sampleRate / 16_000;
    while (this.sourcePosition + 1 < this.sourceSamples.length) {
      const lower = Math.floor(this.sourcePosition);
      const fraction = this.sourcePosition - lower;
      const value = this.sourceSamples[lower] * (1 - fraction) + this.sourceSamples[lower + 1] * fraction;
      this.outputSamples.push(value);
      this.sourcePosition += step;
    }

    const consumed = Math.floor(this.sourcePosition);
    this.sourceSamples = this.sourceSamples.slice(consumed);
    this.sourcePosition -= consumed;

    while (this.outputSamples.length >= 320) {
      this.port.postMessage(new Float32Array(this.outputSamples.splice(0, 320)));
    }
    return true;
  }
}

registerProcessor("pcm-processor", PcmProcessor);
