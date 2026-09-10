import { StartStreamTranscriptionCommand } from "@aws-sdk/client-transcribe-streaming";
import { describe, expect, it, vi } from "vitest";

import { TranscribeRecognizer } from "./transcribe-recognizer.js";

const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe("TranscribeRecognizer", () => {
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

  it("closes audio, aborts the request, and emits only the stable status for an unavailable provider", async () => {
    let requestSignal: AbortSignal | undefined;
    const send = vi.fn((_command: StartStreamTranscriptionCommand, options?: { abortSignal?: AbortSignal }) => {
      requestSignal = options?.abortSignal;
      return Promise.reject(Object.assign(new Error("AWS LimitExceededException details"), {
        name: "LimitExceededException",
      }));
    });
    const destroy = vi.fn();
    const onError = vi.fn();
    const recognizer = new TranscribeRecognizer(
      { awsRegion: "ap-northeast-1" },
      () => ({ send, destroy }),
    );

    const session = await recognizer.start({ language: "ja-JP", onPartial: vi.fn(), onFinal: vi.fn(), onError });
    await flush();

    expect(onError).toHaveBeenCalledWith("recognition_unavailable");
    expect(onError).not.toHaveBeenCalledWith(expect.stringContaining("AWS"));

    await session.stop();
    expect(requestSignal?.aborted).toBe(true);
    expect(destroy).toHaveBeenCalledOnce();
  });

  it.each([
    { event: { LimitExceededException: { name: "LimitExceededException", Message: "private quota details", $metadata: { httpStatusCode: 429 } } } },
    { event: { ServiceUnavailableException: { name: "ServiceUnavailableException", Message: "private availability details", $metadata: { httpStatusCode: 503 } } } },
  ])("ends the result stream after a reconnectable provider event", async ({ event }) => {
    let readAfterProviderEvent = false;
    const send = vi.fn().mockResolvedValue({
      TranscriptResultStream: (async function* () {
        yield event;
        readAfterProviderEvent = true;
        yield { TranscriptEvent: { Transcript: { Results: [{ IsPartial: false, Alternatives: [{ Transcript: "ignored" }] }] } } };
      })(),
    });
    const onError = vi.fn();
    const recognizer = new TranscribeRecognizer(
      { awsRegion: "ap-northeast-1" },
      () => ({ send, destroy: vi.fn() }),
    );

    const session = await recognizer.start({ language: "ja-JP", onPartial: vi.fn(), onFinal: vi.fn(), onError });
    await flush();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith("recognition_unavailable");
    expect(onError).not.toHaveBeenCalledWith(expect.stringContaining("private"));
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
    const recognizer = new TranscribeRecognizer(
      { awsRegion: "ap-northeast-1" },
      () => ({ send, destroy: vi.fn() }),
    );

    const session = await recognizer.start({ language: "ja-JP", onPartial: vi.fn(), onFinal: final, onError });
    await flush();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith("recognition_unavailable");
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
    const send = vi.fn().mockRejectedValue({
      name,
      message: "private provider details",
      $metadata: { httpStatusCode: statusCode },
    });
    const recognizer = new TranscribeRecognizer(
      { awsRegion: "ap-northeast-1" },
      () => ({ send, destroy: vi.fn() }),
    );

    const session = await recognizer.start({ language: "ja-JP", onPartial: vi.fn(), onFinal: final, onError });
    await flush();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith("recognition_unavailable");
    expect(final).not.toHaveBeenCalled();
    await session.stop();
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
