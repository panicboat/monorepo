import type { TranslationRequest, Translator } from "../adapters/contracts.js";

interface TranslationJob {
  request: TranslationRequest;
  onTranslated(text: string): void;
  onFailed(): void;
}

export class TranslationQueue {
  private readonly jobs: TranslationJob[] = [];
  private processing = false;

  constructor(private readonly translator: Translator) {}

  enqueue(job: TranslationJob): void {
    this.jobs.push(job);
    if (!this.processing) void this.process();
  }

  clear(): void {
    this.jobs.length = 0;
  }

  private async process(): Promise<void> {
    this.processing = true;

    while (this.jobs.length > 0) {
      const job = this.jobs.shift();
      if (!job) continue;

      try {
        job.onTranslated(await this.translator.translate(job.request));
      } catch {
        job.onFailed();
      }
    }

    this.processing = false;
  }
}
