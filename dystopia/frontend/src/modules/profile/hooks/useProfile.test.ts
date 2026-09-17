import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

const swrMocks = vi.hoisted(() => ({
  fetcher: vi.fn(),
}));

vi.mock("@/lib/swr", () => ({
  fetcher: swrMocks.fetcher,
}));

const { fetchProfileOrEmpty } = await import("./useProfile");

describe("fetchProfileOrEmpty", () => {
  it("returns an empty editable profile when the account has no profile row yet", async () => {
    swrMocks.fetcher.mockRejectedValueOnce(
      new AppError("NOT_FOUND", "プロフィールが見つかりませんでした", 404)
    );

    const result = await fetchProfileOrEmpty("/api/profile", "account-1");

    expect(result.profile.accountId).toBe("account-1");
    expect(result.profile.displayName).toBe("");
  });

  it("rethrows non-NOT_FOUND errors instead of masking them as an empty profile", async () => {
    const authError = new AppError("UNAUTHORIZED", "ログインしてください", 401);
    swrMocks.fetcher.mockRejectedValueOnce(authError);

    await expect(fetchProfileOrEmpty("/api/profile", "account-1")).rejects.toBe(authError);
  });

  it("passes an existing profile response through untouched", async () => {
    const response = { profile: { accountId: "account-1", displayName: "既存太郎" } };
    swrMocks.fetcher.mockResolvedValueOnce(response);

    await expect(fetchProfileOrEmpty("/api/profile", "account-1")).resolves.toBe(response);
  });
});
