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
});
