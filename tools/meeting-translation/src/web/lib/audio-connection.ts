const reconnectDelays = [250, 500, 1_000, 2_000, 4_000] as const;

export const reconnectDelay = (failedAttempts: number): number | undefined =>
  reconnectDelays[failedAttempts];

export class AudioConnectionState {
  private captureActive = false;
  private joined = false;
  private startSent = false;

  beginConnection(): void {
    this.joined = false;
    this.startSent = false;
  }

  markJoined(): boolean {
    this.joined = true;
    return this.startIfNeeded();
  }

  startCapture(): boolean {
    this.captureActive = true;
    return this.startIfNeeded();
  }

  stopCapture(): boolean {
    const shouldSend = this.joined && this.startSent;
    this.captureActive = false;
    this.startSent = false;
    return shouldSend;
  }

  canSendAudio(): boolean {
    return this.captureActive && this.joined && this.startSent;
  }

  private startIfNeeded(): boolean {
    if (!this.captureActive || !this.joined || this.startSent) return false;
    this.startSent = true;
    return true;
  }
}
