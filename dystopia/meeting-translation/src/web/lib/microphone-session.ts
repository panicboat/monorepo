export interface MicrophoneDependencies {
  createAudioContext: () => AudioContext;
  createAudioWorkletNode: (context: AudioContext) => AudioWorkletNode;
  getUserMedia: () => Promise<MediaStream>;
  moduleUrl: string | URL;
}

const cancelled = (): Error => new Error("Microphone initialization cancelled");

export class MicrophoneResourceOwner {
  private context?: AudioContext;
  private node?: AudioWorkletNode;
  private source?: MediaStreamAudioSourceNode;
  private stream?: MediaStream;
  private disposed = false;
  private disposal?: Promise<void>;

  assertActive(): void {
    if (this.disposed) throw cancelled();
  }

  ownStream(stream: MediaStream): void {
    if (this.disposed) {
      stream.getTracks().forEach((track) => track.stop());
      throw cancelled();
    }
    this.stream = stream;
  }

  async ownContext(context: AudioContext): Promise<void> {
    if (this.disposed) {
      await context.close();
      throw cancelled();
    }
    this.context = context;
  }

  ownSource(source: MediaStreamAudioSourceNode): void {
    if (this.disposed) {
      source.disconnect();
      throw cancelled();
    }
    this.source = source;
  }

  ownNode(node: AudioWorkletNode): void {
    if (this.disposed) {
      node.disconnect();
      throw cancelled();
    }
    this.node = node;
  }

  dispose(): Promise<void> {
    if (this.disposal) return this.disposal;
    this.disposed = true;
    this.disposal = this.disposeOwnedResources();
    return this.disposal;
  }

  private async disposeOwnedResources(): Promise<void> {
    const failures: unknown[] = [];
    const run = (cleanup: () => void): void => {
      try {
        cleanup();
      } catch (error) {
        failures.push(error);
      }
    };

    if (this.node) {
      this.node.port.onmessage = null;
      run(() => this.node?.disconnect());
    }
    if (this.source) run(() => this.source?.disconnect());
    if (this.stream) {
      for (const track of this.stream.getTracks()) run(() => track.stop());
    }
    if (this.context) {
      try {
        await this.context.close();
      } catch (error) {
        failures.push(error);
      }
    }

    if (failures.length > 0) throw new AggregateError(failures, "Microphone cleanup failed");
  }
}

export const initializeMicrophone = async (
  owner: MicrophoneResourceOwner,
  dependencies: MicrophoneDependencies,
  onFrame: (frame: Float32Array) => void,
): Promise<void> => {
  try {
    const stream = await dependencies.getUserMedia();
    owner.ownStream(stream);

    const context = dependencies.createAudioContext();
    await owner.ownContext(context);
    await context.audioWorklet.addModule(dependencies.moduleUrl);
    owner.assertActive();

    const source = context.createMediaStreamSource(stream);
    owner.ownSource(source);
    const node = dependencies.createAudioWorkletNode(context);
    owner.ownNode(node);
    node.port.onmessage = (event: MessageEvent<Float32Array>) => onFrame(event.data);
    source.connect(node);
    node.connect(context.destination);
    owner.assertActive();
  } catch (error) {
    try {
      await owner.dispose();
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "Microphone initialization and cleanup failed");
    }
    throw error;
  }
};
