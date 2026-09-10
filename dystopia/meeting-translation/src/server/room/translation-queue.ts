import type { TranslationRequest, Translator } from "../adapters/contracts.js";

interface TranslationJob {
  getRequest(): TranslationRequest;
  onTranslated(text: string): void;
  onFailed(): void;
}

interface TranslationQueueOptions {
  timeoutMs?: number;
}

type TranslationResult =
  | { kind: "cancelled" }
  | { kind: "translated"; text: string };

const DEFAULT_TRANSLATION_TIMEOUT_MS = 10_000;

export class TranslationQueue {
  private readonly jobs: TranslationJob[] = [];
  private active?: { abortController: AbortController; cancel(): void };
  private closed = false;
  private processing = false;
  private readonly timeoutMs: number;

  constructor(
    private readonly translator: Translator,
    options: TranslationQueueOptions = {},
  ) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TRANSLATION_TIMEOUT_MS;
  }

  enqueue(job: TranslationJob): void {
    if (this.closed) return;
    this.jobs.push(job);
    if (!this.processing) void this.process();
  }

  clear(): void {
    this.closed = true;
    this.jobs.length = 0;
    this.active?.abortController.abort();
    this.active?.cancel();
  }

  private async process(): Promise<void> {
    this.processing = true;

    while (this.jobs.length > 0) {
      const job = this.jobs.shift();
      if (!job) continue;

      const abortController = new AbortController();
      let cancel: () => void = () => undefined;
      const cancelled = new Promise<TranslationResult>((resolve) => {
        cancel = () => resolve({ kind: "cancelled" });
      });
      const active = { abortController, cancel };
      this.active = active;
      let timeout: ReturnType<typeof setTimeout> | undefined;

      try {
        const translation = this.translator
          .translate(job.getRequest(), { signal: abortController.signal })
          .then((text): TranslationResult => ({ kind: "translated", text }));
        const timedOut = new Promise<TranslationResult>((_resolve, reject) => {
          timeout = setTimeout(() => {
            abortController.abort();
            reject(new Error("Translation request timed out"));
          }, this.timeoutMs);
        });
        const result = await Promise.race([translation, timedOut, cancelled]);
        if (!this.closed && result.kind === "translated") job.onTranslated(result.text);
      } catch {
        if (!this.closed) job.onFailed();
      } finally {
        if (timeout) clearTimeout(timeout);
        if (this.active === active) this.active = undefined;
      }
    }

    this.processing = false;
  }
}
