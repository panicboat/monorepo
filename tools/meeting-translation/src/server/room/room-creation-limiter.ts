const WINDOW_MS = 10 * 60 * 1_000;
const MAX_CREATIONS = 5;

export class RoomCreationLimiter {
  private readonly creationTimesByIp = new Map<string, number[]>();

  allow(ipAddress: string, now = Date.now()): boolean {
    const windowStart = now - WINDOW_MS;
    const creationTimes = (this.creationTimesByIp.get(ipAddress) ?? []).filter(
      (createdAt) => createdAt >= windowStart,
    );

    if (creationTimes.length >= MAX_CREATIONS) {
      this.creationTimesByIp.set(ipAddress, creationTimes);
      return false;
    }

    creationTimes.push(now);
    this.creationTimesByIp.set(ipAddress, creationTimes);
    return true;
  }
}
