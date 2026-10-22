import { describe, expect, it } from "vitest";
import { FeedFilter } from "@/stub/feed/v1/feed_service_pb";
import { feedFilterFromString } from "./mappers";

describe("feedFilterFromString", () => {
  it.each([
    ["all", FeedFilter.ALL],
    ["area", FeedFilter.AREA],
    ["following", FeedFilter.FOLLOWING],
    ["followers", FeedFilter.FOLLOWERS],
  ] as const)("maps %s to its proto filter", (value, expected) => {
    expect(feedFilterFromString(value)).toBe(expected);
  });
});
