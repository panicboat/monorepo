import { describe, expect, it, vi } from "vitest";

import type { TranslationRequest, Translator } from "../adapters/contracts.js";
import { TranslationQueue } from "./translation-queue.js";

const request: TranslationRequest = {
  sourceText: "入力した発話",
  sourceLanguage: "ja-JP",
  targetLanguage: "en-US",
  context: [],
  glossary: [],
};

const job = (onTranslated = vi.fn(), onFailed = vi.fn()) => ({
  getRequest: () => request,
  onTranslated,
  onFailed,
});

describe("TranslationQueue", () => {
  it("times out a hung request and continues with the next caption", async () => {
    vi.useFakeTimers();
    try {
      let firstSignal: AbortSignal | undefined;
      let attempt = 0;
      const translator: Translator = {
        translate: vi.fn((_request, options) => {
          attempt += 1;
          if (attempt === 1) {
            firstSignal = options.signal;
            return new Promise<string>(() => undefined);
          }
          return Promise.resolve("translated second caption");
        }),
      };
      const first = job();
      const second = job();
      const queue = new TranslationQueue(translator, { timeoutMs: 10_000 });

      queue.enqueue(first);
      queue.enqueue(second);
      await vi.advanceTimersByTimeAsync(10_000);

      expect(firstSignal?.aborted).toBe(true);
      expect(first.onFailed).toHaveBeenCalledOnce();
      expect(second.onTranslated).toHaveBeenCalledWith("translated second caption");
    } finally {
      vi.useRealTimers();
    }
  });

  it("aborts the active request and suppresses late callbacks after clear", async () => {
    let signal: AbortSignal | undefined;
    let resolveTranslation: (text: string) => void = () => undefined;
    const translator: Translator = {
      translate: (_request, options) => {
        signal = options.signal;
        return new Promise((resolve) => { resolveTranslation = resolve; });
      },
    };
    const active = job();
    const queued = job();
    const queue = new TranslationQueue(translator);

    queue.enqueue(active);
    queue.enqueue(queued);
    queue.clear();
    resolveTranslation("late translation");
    await Promise.resolve();

    expect(signal?.aborted).toBe(true);
    expect(active.onTranslated).not.toHaveBeenCalled();
    expect(active.onFailed).not.toHaveBeenCalled();
    expect(queued.onTranslated).not.toHaveBeenCalled();
    expect(queued.onFailed).not.toHaveBeenCalled();
  });
});
