import {
  StartStreamTranscriptionCommand,
  TranscribeStreamingClient,
  type AudioStream,
  type StartStreamTranscriptionCommandOutput,
} from "@aws-sdk/client-transcribe-streaming";

import type { ServiceConfig } from "../config.js";
import type { RecognitionOptions, RecognitionSession, SpeechRecognizer } from "./contracts.js";

interface TranscribeClient {
  send(
    command: StartStreamTranscriptionCommand,
    options?: { abortSignal?: AbortSignal },
  ): Promise<StartStreamTranscriptionCommandOutput>;
  destroy(): void;
}

export type TranscribeClientFactory = (config: { region: string }) => TranscribeClient;

class AsyncAudioQueue implements AsyncIterable<AudioStream> {
  private readonly chunks: Uint8Array[] = [];
  private waiting?: () => void;
  private closed = false;

  push(chunk: Uint8Array): void {
    if (this.closed) return;
    this.chunks.push(chunk);
    this.waiting?.();
    this.waiting = undefined;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.waiting?.();
    this.waiting = undefined;
  }

  async *[Symbol.asyncIterator](): AsyncIterator<AudioStream> {
    while (true) {
      const chunk = await this.nextChunk();
      if (!chunk) return;
      yield { AudioEvent: { AudioChunk: chunk } };
    }
  }

  private async nextChunk(): Promise<Uint8Array | undefined> {
    while (this.chunks.length === 0 && !this.closed) {
      await new Promise<void>((resolve) => { this.waiting = resolve; });
    }
    return this.chunks.shift();
  }
}

const isReconnectableProviderError = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) return false;
  const providerError = error as { name?: unknown; $metadata?: { httpStatusCode?: unknown } };
  const statusCode = providerError.$metadata?.httpStatusCode;
  return statusCode === 429
    || statusCode === 503
    || providerError.name === "LimitExceededException"
    || providerError.name === "ServiceUnavailableException";
};

export class TranscribeRecognizer implements SpeechRecognizer {
  constructor(
    private readonly config: Pick<ServiceConfig, "awsRegion">,
    private readonly createClient: TranscribeClientFactory = (clientConfig) => {
      const client = new TranscribeStreamingClient(clientConfig);
      return {
        send: (command, options) => client.send(command, options),
        destroy: () => client.destroy(),
      };
    },
  ) {}

  async start(options: RecognitionOptions): Promise<RecognitionSession> {
    const client = this.createClient({ region: this.config.awsRegion });
    const queue = new AsyncAudioQueue();
    const abortController = new AbortController();
    const resultLoop = this.readResults(client, queue, abortController, options);
    let stopPromise: Promise<void> | undefined;

    return {
      write: (chunk) => queue.push(chunk),
      stop: () => {
        stopPromise ??= this.stop(queue, abortController, resultLoop, client);
        return stopPromise;
      },
    };
  }

  private async readResults(
    client: TranscribeClient,
    queue: AsyncAudioQueue,
    abortController: AbortController,
    options: RecognitionOptions,
  ): Promise<void> {
    try {
      const response = await client.send(new StartStreamTranscriptionCommand({
        LanguageCode: options.language,
        MediaEncoding: "pcm",
        MediaSampleRateHertz: 16_000,
        EnablePartialResultsStabilization: true,
        PartialResultsStability: "low",
        AudioStream: queue,
      }), { abortSignal: abortController.signal });

      for await (const event of response.TranscriptResultStream ?? []) {
        for (const result of event.TranscriptEvent?.Transcript?.Results ?? []) {
          const text = result.Alternatives?.[0]?.Transcript?.trim();
          if (!text) continue;
          if (result.IsPartial === true) options.onPartial(text);
          else options.onFinal(text);
        }
      }
    } catch (error) {
      if (isReconnectableProviderError(error)) {
        options.onError("recognition_unavailable");
        return;
      }
      // SILENT: non-reconnectable provider details must not reach participants.
    }
  }

  private async stop(
    queue: AsyncAudioQueue,
    abortController: AbortController,
    resultLoop: Promise<void>,
    client: TranscribeClient,
  ): Promise<void> {
    queue.close();
    abortController.abort();
    await resultLoop;
    client.destroy();
  }
}
