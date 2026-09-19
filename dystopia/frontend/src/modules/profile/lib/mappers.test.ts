import { describe, expect, it } from "vitest";
import { create } from "@bufbuild/protobuf";
import { ProfileSchema } from "@/stub/profile/v1/service_pb";
import { emptyProfileView, mapProfileToView, profileViewToSavePayload, buildSaveProfileRequest } from "./mappers";

describe("mapProfileToView", () => {
  it("maps body_stats into a BodyStatsView", () => {
    const proto = create(ProfileSchema, {
      accountId: "acc-1",
      bodyStats: { heightCm: 158, bustCm: 88, waistCm: 58, hipCm: 86, cup: "D" },
    });

    const view = mapProfileToView(proto);

    expect(view.bodyStats).toEqual({ heightCm: 158, bust: 88, waist: 58, hip: 86, cup: "D" });
  });

  it("defaults body_stats to zero/empty when absent", () => {
    const proto = create(ProfileSchema, { accountId: "acc-1" });

    const view = mapProfileToView(proto);

    expect(view.bodyStats).toEqual({ heightCm: 0, bust: 0, waist: 0, hip: 0, cup: "" });
  });

  it("maps the cityheaven sns link", () => {
    const proto = create(ProfileSchema, {
      accountId: "acc-1",
      snsLinks: { cityheaven: "https://www.cityheaven.net/example/" },
    });

    const view = mapProfileToView(proto);

    expect(view.snsLinks.cityheaven).toBe("https://www.cityheaven.net/example/");
  });
});

describe("emptyProfileView", () => {
  it("has a zeroed bodyStats", () => {
    expect(emptyProfileView("acc-1").bodyStats).toEqual({ heightCm: 0, bust: 0, waist: 0, hip: 0, cup: "" });
  });
});

describe("profileViewToSavePayload / buildSaveProfileRequest", () => {
  it("round-trips bodyStats and cityheaven through the save request", () => {
    const view = emptyProfileView("acc-1");
    view.bodyStats = { heightCm: 158, bust: 88, waist: 58, hip: 86, cup: "D" };
    view.snsLinks.cityheaven = "https://www.cityheaven.net/example/";

    const payload = profileViewToSavePayload(view);
    const request = buildSaveProfileRequest(payload);

    expect(request.bodyStats).toEqual({ heightCm: 158, bustCm: 88, waistCm: 58, hipCm: 86, cup: "D" });
    expect(request.snsLinks.cityheaven).toBe("https://www.cityheaven.net/example/");
  });
});
