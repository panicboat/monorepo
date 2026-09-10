import {
  StartStreamTranscriptionCommand,
  TranscribeStreamingClient,
  type AudioStream,
  type StartStreamTranscriptionCommandOutput,
  type TranscriptResultStream,
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

interface TranscribeRetryDependencies {
  wait(delayMs: number, signal: AbortSignal): Promise<void>;
}

interface StreamAttempt {
  abortController: AbortController;
  client: TranscribeClient;
  queue: AsyncAudioQueue;
}

type StreamOutcome = "failed" | "reconnectable" | "stopped" | "unexpected_end";

const reconnectDelays = [250, 500, 1_000, 2_000, 4_000] as const;

const waitForRetry = (delayMs: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, delayMs);
    signal.addEventListener("abort", finish, { once: true });
  });

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
    this.chunks.length = 0;
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

const isReconnectableProviderEvent = (event: TranscriptResultStream): boolean =>
  isReconnectableProviderError(event.LimitExceededException)
  || isReconnectableProviderError(event.ServiceUnavailableException);

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
    private readonly retry: TranscribeRetryDependencies = { wait: waitForRetry },
  ) {}

  async start(options: RecognitionOptions): Promise<RecognitionSession> {
    const sessionAbortController = new AbortController();
    let activeAttempt: StreamAttempt | undefined;
    const resultLoop = this.runSession(options, sessionAbortController, (attempt) => {
      activeAttempt = attempt;
    });
    let stopPromise: Promise<void> | undefined;

    return {
      write: (chunk) => activeAttempt?.queue.push(chunk),
      stop: () => {
        if (!stopPromise) {
          sessionAbortController.abort();
          activeAttempt?.queue.close();
          activeAttempt?.abortController.abort();
          stopPromise = resultLoop;
        }
        return stopPromise;
      },
    };
  }

  private async runSession(
    options: RecognitionOptions,
    sessionAbortController: AbortController,
    setActiveAttempt: (attempt: StreamAttempt | undefined) => void,
  ): Promise<void> {
    for (let retryIndex = 0; ; retryIndex += 1) {
      if (sessionAbortController.signal.aborted) return;
      const attempt: StreamAttempt = {
        abortController: new AbortController(),
        client: this.createClient({ region: this.config.awsRegion }),
        queue: new AsyncAudioQueue(),
      };
      setActiveAttempt(attempt);
      const outcome = await this.readResults(attempt, options, retryIndex > 0);
      this.releaseAttempt(attempt);
      setActiveAttempt(undefined);

      if (sessionAbortController.signal.aborted || outcome === "stopped") return;
      const delay = outcome === "reconnectable" ? reconnectDelays[retryIndex] : undefined;
      if (delay === undefined) {
        options.onError("recognition_unavailable");
        return;
      }

      options.onReconnecting?.();
      await this.retry.wait(delay, sessionAbortController.signal);
    }
  }

  private async readResults(
    attempt: StreamAttempt,
    options: RecognitionOptions,
    reconnecting: boolean,
  ): Promise<StreamOutcome> {
    try {
      const response = await attempt.client.send(new StartStreamTranscriptionCommand({
        LanguageCode: options.language,
        MediaEncoding: "pcm",
        MediaSampleRateHertz: 16_000,
        EnablePartialResultsStabilization: true,
        PartialResultsStability: "low",
        AudioStream: attempt.queue,
      }), { abortSignal: attempt.abortController.signal });
      if (reconnecting) options.onReconnected?.();

      for await (const event of response.TranscriptResultStream ?? []) {
        if (isReconnectableProviderEvent(event)) {
          return "reconnectable";
        }
        for (const result of event.TranscriptEvent?.Transcript?.Results ?? []) {
          const text = result.Alternatives?.[0]?.Transcript?.trim();
          if (!text) continue;
          if (result.IsPartial === true) options.onPartial(text);
          else options.onFinal(text);
        }
      }
      return attempt.abortController.signal.aborted ? "stopped" : "unexpected_end";
    } catch (error) {
      if (attempt.abortController.signal.aborted) return "stopped";
      return isReconnectableProviderError(error) ? "reconnectable" : "failed";
    }
  }

  private releaseAttempt(attempt: StreamAttempt): void {
    attempt.queue.close();
    attempt.abortController.abort();
    attempt.client.destroy();
  }
}
