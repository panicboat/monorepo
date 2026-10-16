import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getKey: undefined as ((index: number, prev: unknown) => string | null) | undefined,
  state: { activeProfileId: "p-1" as string | null, role: "cast" as string | null },
  data: undefined as unknown,
}));

vi.mock("swr/infinite", () => ({
  default: (getKey: (index: number, prev: unknown) => string | null) => {
    mocks.getKey = getKey;
    return { data: mocks.data, error: undefined, size: 1, setSize: vi.fn(), isLoading: false, isValidating: false, mutate: vi.fn() };
  },
}));
vi.mock("@/lib/swr", () => ({ fetcher: vi.fn() }));
vi.mock("../lib/revalidate", () => ({ useKarteRevalidation: vi.fn() }));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: typeof mocks.state) => unknown) => selector(mocks.state),
  selectRole: (state: { role: string | null }) => state.role,
}));

const { useMyKarte } = await import("./useMyKarte");

describe("useMyKarte request key", () => {
  beforeEach(() => {
    mocks.state = { activeProfileId: "p-1", role: "cast" };
  });

  it("requests the first page for a cast", () => {
    useMyKarte();

    expect(mocks.getKey?.(0, null)).toBe("/api/karte/my");
  });

  it("does not request anything for a guest or before the role is known", () => {
    mocks.state = { activeProfileId: "p-1", role: "guest" };
    useMyKarte();
    expect(mocks.getKey?.(0, null)).toBeNull();

    mocks.state = { activeProfileId: "p-1", role: null };
    useMyKarte();
    expect(mocks.getKey?.(0, null)).toBeNull();
  });
});

describe("useMyKarte counts", () => {
  it("takes the counts from the first page and drops a karte repeated on a later page", () => {
    mocks.state = { activeProfileId: "p-1", role: "cast" };
    mocks.data = [
      { kartes: [{ id: "a" }, { id: "b" }], hasMore: true, nextCursor: "c1", counts: { total: 3, open: 2, closed: 1 } },
      { kartes: [{ id: "b" }, { id: "c" }], hasMore: false, nextCursor: "", counts: { total: 0, open: 0, closed: 0 } },
    ];

    const result = useMyKarte();

    expect(result.counts).toEqual({ total: 3, open: 2, closed: 1 });
    expect(result.kartes.map((k) => k.id)).toEqual(["a", "b", "c"]);
    mocks.data = undefined;
  });
});
