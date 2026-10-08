import { describe, expect, it } from "vitest";
import { create } from "@bufbuild/protobuf";
import { KarteEntrySchema } from "@/stub/karte/v1/service_pb";
import { mapKarteEntryToView } from "./mappers";

describe("mapKarteEntryToView", () => {
  it("maps the author and target profile ids and the ownership flag", () => {
    const view = mapKarteEntryToView(
      create(KarteEntrySchema, {
        id: "e-1",
        authorProfileId: "author-profile",
        targetProfileId: "target-profile",
        isMine: true,
        authorUsername: "cast_taro",
        targetUsername: "guest_hanako",
        rating: 4,
        body: "memo",
        flagged: true,
      })
    );

    expect(view).toMatchObject({
      id: "e-1",
      authorProfileId: "author-profile",
      targetProfileId: "target-profile",
      isMine: true,
      authorUsername: "cast_taro",
      targetUsername: "guest_hanako",
      rating: 4,
      body: "memo",
      flagged: true,
    });
  });

  it("has no account id field", () => {
    const view = mapKarteEntryToView(create(KarteEntrySchema, { id: "e-1" }));

    expect(Object.keys(view)).not.toContain("authorAccountId");
    expect(Object.keys(view)).not.toContain("targetAccountId");
  });

  it("defaults missing strings, the flag, and timestamps", () => {
    const view = mapKarteEntryToView(create(KarteEntrySchema, { id: "e-1" }));

    expect(view.isMine).toBe(false);
    expect(view.authorUsername).toBe("");
    expect(view.targetAvatarUrl).toBe("");
    expect(view.createdAt).toBe("");
    expect(view.updatedAt).toBe("");
  });

  it("converts timestamps to ISO strings", () => {
    const view = mapKarteEntryToView(
      create(KarteEntrySchema, { id: "e-1", createdAt: { seconds: BigInt(1_700_000_000), nanos: 0 } })
    );

    expect(view.createdAt).toBe(new Date(1_700_000_000 * 1000).toISOString());
  });
});
