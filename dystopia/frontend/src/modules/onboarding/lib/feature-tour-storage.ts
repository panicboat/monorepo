const STORAGE_KEY = "feature-tour-seen";

export interface FeatureTourStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

function defaultStorage(): FeatureTourStorage | undefined {
  return typeof localStorage === "undefined" ? undefined : localStorage;
}

export function hasSeenFeatureTour(storage: FeatureTourStorage | undefined = defaultStorage()): boolean {
  return storage?.getItem(STORAGE_KEY) === "1";
}

export function markFeatureTourSeen(storage: FeatureTourStorage | undefined = defaultStorage()): void {
  storage?.setItem(STORAGE_KEY, "1");
}
