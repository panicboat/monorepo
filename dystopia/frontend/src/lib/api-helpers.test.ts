import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Code, ConnectError } from "@connectrpc/connect";
import { handleApiError } from "./api-helpers";

describe("handleApiError", () => {
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it("copies the monolith's error-reason into the code field", async () => {
    const error = new ConnectError("Active profile required", Code.FailedPrecondition, new Headers({ "error-reason": "profile_required" }));

    const res = handleApiError(error);

    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("profile_required");
  });

  it("copies profile_not_permitted on a 403", async () => {
    const error = new ConnectError("Profile is not available", Code.PermissionDenied, new Headers({ "error-reason": "profile_not_permitted" }));

    const res = handleApiError(error);

    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("profile_not_permitted");
  });

  it("omits the code field when the monolith gives no reason", async () => {
    const res = handleApiError(new ConnectError("follow required", Code.FailedPrecondition));
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body).not.toHaveProperty("code");
    expect(typeof body.error).toBe("string");
  });

  it("keeps the raw message for an invalid argument", async () => {
    const res = handleApiError(new ConnectError("このユーザー名は使用できません", Code.InvalidArgument));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("このユーザー名は使用できません");
  });

  it("returns 500 without a code for a non-Connect error", async () => {
    const res = handleApiError(new Error("boom"));

    expect(res.status).toBe(500);
    expect(await res.json()).not.toHaveProperty("code");
  });
});
