const OUTPUT_SAMPLE_RATE = 16_000;
const FRAME_SAMPLE_COUNT = 320;

export class StreamingPcmResampler {
  private readonly step: number;
  private readonly sourceSamples: number[] = [];
  private sourcePosition = 0;
  private readonly outputSamples: number[] = [];

  constructor(sourceSampleRate: number) {
    this.step = sourceSampleRate / OUTPUT_SAMPLE_RATE;
  }

  push(input: Float32Array): Float32Array[] {
    this.sourceSamples.push(...input);

    while (this.sourcePosition + 1 < this.sourceSamples.length) {
      const lower = Math.floor(this.sourcePosition);
      const fraction = this.sourcePosition - lower;
      this.outputSamples.push(
        this.sourceSamples[lower] * (1 - fraction)
          + this.sourceSamples[lower + 1] * fraction,
      );
      this.sourcePosition += this.step;
    }

    const consumed = Math.min(
      Math.floor(this.sourcePosition),
      Math.max(0, this.sourceSamples.length - 1),
    );
    this.sourceSamples.splice(0, consumed);
    this.sourcePosition -= consumed;

    const frames: Float32Array[] = [];
    while (this.outputSamples.length >= FRAME_SAMPLE_COUNT) {
      frames.push(new Float32Array(this.outputSamples.splice(0, FRAME_SAMPLE_COUNT)));
    }
    return frames;
  }
}
