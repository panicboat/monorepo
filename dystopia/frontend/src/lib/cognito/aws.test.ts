import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAwsAdapter } from "./aws";
import { usernameForPhone } from "./phone";

const identity = vi.hoisted(() => ({ releaseIncompleteSignUp: vi.fn() }));

vi.mock("@/lib/grpc", () => ({
  identityClient: { releaseIncompleteSignUp: identity.releaseIncompleteSignUp },
}));

describe("createAwsAdapter releaseIncompleteSignUp", () => {
  beforeEach(() => identity.releaseIncompleteSignUp.mockReset());

  it("asks the monolith to release the sign-up under the username derived from the phone", async () => {
    identity.releaseIncompleteSignUp.mockResolvedValue({ released: true });

    await expect(createAwsAdapter().releaseIncompleteSignUp("090-0000-0101")).resolves.toBe(true);

    expect(identity.releaseIncompleteSignUp).toHaveBeenCalledWith({
      username: usernameForPhone("090-0000-0101"),
    });
  });

  it("returns false when the monolith keeps the user", async () => {
    identity.releaseIncompleteSignUp.mockResolvedValue({ released: false });

    await expect(createAwsAdapter().releaseIncompleteSignUp("+819000000101")).resolves.toBe(false);
  });
});
