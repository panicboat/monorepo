import { StartStreamTranscriptionCommand } from "@aws-sdk/client-transcribe-streaming";
import { describe, expect, it, vi } from "vitest";

import { TranscribeRecognizer } from "./transcribe-recognizer.js";

const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe("TranscribeRecognizer", () => {
  it("reports and releases a non-reconnectable provider failure without waiting for stop", async () => {
    let requestSignal: AbortSignal | undefined;
    let audioStream: AsyncIterable<unknown> | undefined;
    const destroy = vi.fn();
    const onError = vi.fn();
    const recognizer = new TranscribeRecognizer(
      { awsRegion: "ap-northeast-1" },
      () => ({
        send: vi.fn((command: StartStreamTranscriptionCommand, options?: { abortSignal?: AbortSignal }) => {
          requestSignal = options?.abortSignal;
          audioStream = command.input.AudioStream;
          return Promise.reject(Object.assign(new Error("private provider failure"), {
            name: "BadRequestException",
            $metadata: { httpStatusCode: 400 },
          }));
        }),
        destroy,
      }),
    );

    const session = await recognizer.start({ language: "ja-JP", onPartial: vi.fn(), onFinal: vi.fn(), onError });
    session.write(new Uint8Array([7]));
    await flush();

    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith("recognition_unavailable");
    expect(requestSignal?.aborted).toBe(true);
    await expect(audioStream?.[Symbol.asyncIterator]().next()).resolves.toMatchObject({ done: true });
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("reports and releases an unexpected transcript stream end", async () => {
    let requestSignal: AbortSignal | undefined;
    const destroy = vi.fn();
    const onError = vi.fn();
    const recognizer = new TranscribeRecognizer(
      { awsRegion: "ap-northeast-1" },
      () => ({
        send: vi.fn((_command, options?: { abortSignal?: AbortSignal }) => {
          requestSignal = options?.abortSignal;
          return Promise.resolve({
            $metadata: {},
            TranscriptResultStream: (async function* () {})(),
          });
        }),
        destroy,
      }),
    );

    await recognizer.start({ language: "ja-JP", onPartial: vi.fn(), onFinal: vi.fn(), onError });
    await flush();

    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith("recognition_unavailable");
    expect(requestSignal?.aborted).toBe(true);
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("restarts with a new queue and client after a reconnectable failure", async () => {
    const clients: Array<{ destroy: () => void; signal?: AbortSignal; stream?: AsyncIterable<unknown> }> = [];
    const createClient = vi.fn(() => {
      const client: { destroy: () => void; signal?: AbortSignal; stream?: AsyncIterable<unknown> } = {
        destroy: vi.fn(),
      };
      clients.push(client);
      return {
        destroy: client.destroy,
        send: vi.fn((command: StartStreamTranscriptionCommand, options?: { abortSignal?: AbortSignal }) => {
          client.signal = options?.abortSignal;
          client.stream = command.input.AudioStream;
          if (clients.length === 1) {
            return Promise.reject(Object.assign(new Error("retry"), { name: "ServiceUnavailableException" }));
          }
          return Promise.resolve({
            $metadata: {},
            TranscriptResultStream: (async function* () {
              await new Promise<void>((resolve) => options?.abortSignal?.addEventListener("abort", () => resolve()));
            })(),
          });
        }),
      };
    });
    const onError = vi.fn();
    const onReconnected = vi.fn();
    const onReconnecting = vi.fn();
    const wait = vi.fn().mockResolvedValue(undefined);
    const recognizer = new TranscribeRecognizer(
      { awsRegion: "ap-northeast-1" },
      createClient,
      { wait },
    );

    const session = await recognizer.start({
      language: "ja-JP",
      onPartial: vi.fn(),
      onFinal: vi.fn(),
      onError,
      onReconnected,
      onReconnecting,
    });
    await flush();

    expect(createClient).toHaveBeenCalledTimes(2);
    expect(clients[0]?.signal?.aborted).toBe(true);
    expect(clients[0]?.destroy).toHaveBeenCalledOnce();
    expect(onReconnecting).toHaveBeenCalledOnce();
    expect(onReconnected).toHaveBeenCalledOnce();
    expect(onError).not.toHaveBeenCalled();
    session.write(new Uint8Array([1, 2]));
    const nextChunk = await clients[1]?.stream?.[Symbol.asyncIterator]().next();
    expect(nextChunk).toMatchObject({ value: { AudioEvent: { AudioChunk: new Uint8Array([1, 2]) } } });

    await session.stop();
    expect(clients[1]?.signal?.aborted).toBe(true);
    expect(clients[1]?.destroy).toHaveBeenCalledOnce();
  });

  it("cancels a reconnect wait and does not create another client after stop", async () => {
    let waitSignal: AbortSignal | undefined;
    let audioStream: AsyncIterable<unknown> | undefined;
    const wait = vi.fn((_delay: number, signal: AbortSignal) => {
      waitSignal = signal;
      return new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve()));
    });
    const createClient = vi.fn(() => ({
      send: vi.fn((command: StartStreamTranscriptionCommand) => {
        audioStream = command.input.AudioStream;
        return Promise.reject(Object.assign(new Error("retry"), { name: "LimitExceededException" }));
      }),
      destroy: vi.fn(),
    }));
    const recognizer = new TranscribeRecognizer(
      { awsRegion: "ap-northeast-1" },
      createClient,
      { wait },
    );

    const session = await recognizer.start({
      language: "ja-JP",
      onPartial: vi.fn(),
      onFinal: vi.fn(),
      onError: vi.fn(),
      onReconnecting: vi.fn(),
    });
    await flush();
    session.write(new Uint8Array([9]));
    await expect(audioStream?.[Symbol.asyncIterator]().next()).resolves.toMatchObject({ done: true });
    await session.stop();

    expect(waitSignal?.aborted).toBe(true);
    expect(createClient).toHaveBeenCalledOnce();
  });

  it("creates a participant stream with PCM audio and routes partial and final transcripts", async () => {
    const send = vi.fn().mockResolvedValue({
      TranscriptResultStream: (async function* () {
        yield {
          TranscriptEvent: {
            Transcript: {
              Results: [
                { IsPartial: true, Alternatives: [{ Transcript: "未確定" }] },
                { IsPartial: false, Alternatives: [{ Transcript: "確定" }] },
              ],
            },
          },
        };
      })(),
    });
    const destroy = vi.fn();
    const createClient = vi.fn(() => ({ send, destroy }));
    const partial = vi.fn();
    const final = vi.fn();
    const recognizer = new TranscribeRecognizer({ awsRegion: "ap-northeast-1" }, createClient);

    const session = await recognizer.start({ language: "ja-JP", onPartial: partial, onFinal: final, onError: vi.fn() });
    await flush();

    expect(createClient).toHaveBeenCalledWith({ region: "ap-northeast-1" });
    expect(send).toHaveBeenCalledOnce();
    const command = send.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(StartStreamTranscriptionCommand);
    expect(command.input).toMatchObject({
      LanguageCode: "ja-JP",
      MediaEncoding: "pcm",
      MediaSampleRateHertz: 16_000,
      EnablePartialResultsStabilization: true,
      PartialResultsStability: "low",
      AudioStream: expect.anything(),
    });
    expect(partial).toHaveBeenCalledWith("未確定");
    expect(final).toHaveBeenCalledWith("確定");

    await session.stop();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("closes audio and starts reconnecting for an unavailable provider", async () => {
    let requestSignal: AbortSignal | undefined;
    const send = vi.fn((_command: StartStreamTranscriptionCommand, options?: { abortSignal?: AbortSignal }) => {
      requestSignal = options?.abortSignal;
      return Promise.reject(Object.assign(new Error("AWS LimitExceededException details"), {
        name: "LimitExceededException",
      }));
    });
    const destroy = vi.fn();
    const onError = vi.fn();
    const onReconnecting = vi.fn();
    const recognizer = new TranscribeRecognizer(
      { awsRegion: "ap-northeast-1" },
      () => ({ send, destroy }),
    );

    const session = await recognizer.start({
      language: "ja-JP", onPartial: vi.fn(), onFinal: vi.fn(), onError, onReconnecting,
    });
    await flush();

    expect(onReconnecting).toHaveBeenCalledOnce();
    expect(onError).not.toHaveBeenCalled();

    await session.stop();
    expect(requestSignal?.aborted).toBe(true);
    expect(destroy).toHaveBeenCalledOnce();
  });

  it.each([
    { event: { LimitExceededException: { name: "LimitExceededException", Message: "private quota details", $metadata: { httpStatusCode: 429 } } } },
    { event: { ServiceUnavailableException: { name: "ServiceUnavailableException", Message: "private availability details", $metadata: { httpStatusCode: 503 } } } },
  ])("ends the result stream and starts reconnecting after a provider event", async ({ event }) => {
    let readAfterProviderEvent = false;
    const send = vi.fn().mockResolvedValue({
      TranscriptResultStream: (async function* () {
        yield event;
        readAfterProviderEvent = true;
        yield { TranscriptEvent: { Transcript: { Results: [{ IsPartial: false, Alternatives: [{ Transcript: "ignored" }] }] } } };
      })(),
    });
    const onError = vi.fn();
    const onReconnecting = vi.fn();
    const recognizer = new TranscribeRecognizer(
      { awsRegion: "ap-northeast-1" },
      () => ({ send, destroy: vi.fn() }),
    );

    const session = await recognizer.start({
      language: "ja-JP", onPartial: vi.fn(), onFinal: vi.fn(), onError, onReconnecting,
    });
    await flush();

    expect(onReconnecting).toHaveBeenCalledOnce();
    expect(onError).not.toHaveBeenCalled();
    expect(readAfterProviderEvent).toBe(false);
    await session.stop();
  });

  it.each([
    ["missing", undefined, 429],
    ["unsupported", "UnrecognizedProviderEvent", 503],
  ])("uses a stream provider event status code with a %s name", async (_nameType, name, statusCode) => {
    let readAfterProviderEvent = false;
    const final = vi.fn();
    const send = vi.fn().mockResolvedValue({
      TranscriptResultStream: (async function* () {
        yield { LimitExceededException: { name, Message: "private provider details", $metadata: { httpStatusCode: statusCode } } };
        readAfterProviderEvent = true;
        yield { TranscriptEvent: { Transcript: { Results: [{ IsPartial: false, Alternatives: [{ Transcript: "must not route" }] }] } } };
      })(),
    });
    const onError = vi.fn();
    const onReconnecting = vi.fn();
    const recognizer = new TranscribeRecognizer(
      { awsRegion: "ap-northeast-1" },
      () => ({ send, destroy: vi.fn() }),
    );

    const session = await recognizer.start({
      language: "ja-JP", onPartial: vi.fn(), onFinal: final, onError, onReconnecting,
    });
    await flush();

    expect(onReconnecting).toHaveBeenCalledOnce();
    expect(onError).not.toHaveBeenCalled();
    expect(final).not.toHaveBeenCalled();
    expect(readAfterProviderEvent).toBe(false);
    await session.stop();
  });

  it.each([
    ["missing", undefined, 429],
    ["unsupported", "UnrecognizedProviderError", 503],
  ])("uses a rejected request status code with a %s name", async (_nameType, name, statusCode) => {
    const final = vi.fn();
    const onError = vi.fn();
    const onReconnecting = vi.fn();
    const send = vi.fn().mockRejectedValue({
      name,
      message: "private provider details",
      $metadata: { httpStatusCode: statusCode },
    });
    const recognizer = new TranscribeRecognizer(
      { awsRegion: "ap-northeast-1" },
      () => ({ send, destroy: vi.fn() }),
    );

    const session = await recognizer.start({
      language: "ja-JP", onPartial: vi.fn(), onFinal: final, onError, onReconnecting,
    });
    await flush();

    expect(onReconnecting).toHaveBeenCalledOnce();
    expect(onError).not.toHaveBeenCalled();
    expect(final).not.toHaveBeenCalled();
    await session.stop();
  });

  it("reports recognition unavailable after reconnect attempts are exhausted", async () => {
    const onError = vi.fn();
    const onReconnecting = vi.fn();
    const createClient = vi.fn(() => ({
      send: vi.fn().mockRejectedValue(Object.assign(new Error("private retry failure"), {
        name: "ServiceUnavailableException",
      })),
      destroy: vi.fn(),
    }));
    const recognizer = new TranscribeRecognizer(
      { awsRegion: "ap-northeast-1" },
      createClient,
      { wait: vi.fn().mockResolvedValue(undefined) },
    );

    await recognizer.start({
      language: "ja-JP", onPartial: vi.fn(), onFinal: vi.fn(), onError, onReconnecting,
    });
    await flush();

    expect(onReconnecting).toHaveBeenCalledTimes(5);
    expect(createClient).toHaveBeenCalledTimes(6);
    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith("recognition_unavailable");
  });

  it("closes queued audio before aborting and destroys only after the result loop finishes", async () => {
    const events: string[] = [];
    let resultLoopFinished = false;
    const send = vi.fn((command: StartStreamTranscriptionCommand, options?: { abortSignal?: AbortSignal }) => {
      const audioStream = command.input.AudioStream;
      if (!audioStream) throw new Error("audio stream was not provided");
      const close = vi.spyOn(audioStream as unknown as { close: () => void }, "close");
      const audioEnded = (async () => {
        const item = await audioStream[Symbol.asyncIterator]().next();
        expect(item.done).toBe(true);
        events.push("audio_closed");
      })();
      options?.abortSignal?.addEventListener("abort", () => {
        expect(close).toHaveBeenCalledOnce();
        events.push("aborted");
      });

      return Promise.resolve({
        $metadata: {},
        TranscriptResultStream: (async function* () {
          await audioEnded;
          resultLoopFinished = true;
          events.push("result_loop_finished");
        })(),
      });
    });
    const destroy = () => {
      expect(resultLoopFinished).toBe(true);
      events.push("destroyed");
    };
    const recognizer = new TranscribeRecognizer(
      { awsRegion: "ap-northeast-1" },
      () => ({ send, destroy }),
    );

    const session = await recognizer.start({ language: "ja-JP", onPartial: vi.fn(), onFinal: vi.fn(), onError: vi.fn() });
    await session.stop();

    expect(events).toEqual(["aborted", "audio_closed", "result_loop_finished", "destroyed"]);
  });
});
