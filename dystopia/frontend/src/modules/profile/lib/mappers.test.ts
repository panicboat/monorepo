import { describe, expect, it } from "vitest";
import { create } from "@bufbuild/protobuf";
import { ProfileSchema, ProfileSummarySchema } from "@/stub/profile/v1/service_pb";
import { emptyProfileView, mapProfileToView, profileViewToSavePayload, buildSaveProfileRequest, summaryToView } from "./mappers";

describe("mapProfileToView", () => {
  it("maps body_stats into a BodyStatsView", () => {
    const proto = create(ProfileSchema, {
      id: "prof-1",
      bodyStats: { heightCm: 158, bustCm: 88, waistCm: 58, hipCm: 86, cup: "D" },
    });

    const view = mapProfileToView(proto);

    expect(view.bodyStats).toEqual({ heightCm: 158, bust: 88, waist: 58, hip: 86, cup: "D" });
  });

  it("defaults body_stats to zero/empty when absent", () => {
    const proto = create(ProfileSchema, { id: "prof-1" });

    const view = mapProfileToView(proto);

    expect(view.bodyStats).toEqual({ heightCm: 0, bust: 0, waist: 0, hip: 0, cup: "" });
  });

  it("maps the cityheaven sns link", () => {
    const proto = create(ProfileSchema, {
      id: "prof-1",
      snsLinks: { cityheaven: "https://www.cityheaven.net/example/" },
    });

    const view = mapProfileToView(proto);

    expect(view.snsLinks.cityheaven).toBe("https://www.cityheaven.net/example/");
  });

  it("maps the litlink sns link", () => {
    const proto = create(ProfileSchema, {
      id: "prof-1",
      snsLinks: { litlink: "https://lit.link/yuna" },
    });

    const view = mapProfileToView(proto);

    expect(view.snsLinks.litlink).toBe("https://lit.link/yuna");
  });

  it("carries the profile id and no account id", () => {
    const proto = create(ProfileSchema, { id: "prof-1" });

    const view = mapProfileToView(proto);

    expect(view.id).toBe("prof-1");
    expect(Object.keys(view)).not.toContain("accountId");
  });

  it("maps the follow approval flag", () => {
    expect(mapProfileToView(create(ProfileSchema, { id: "prof-1", followApprovalRequired: true })).followApprovalRequired).toBe(true);
    expect(mapProfileToView(create(ProfileSchema, { id: "prof-1" })).followApprovalRequired).toBe(false);
  });

  it("maps the prefecture and the main area", () => {
    const view = mapProfileToView(create(ProfileSchema, { id: "prof-1", prefecture: "東京都", area: "新宿" }));

    expect(view).toMatchObject({ prefecture: "東京都", area: "新宿" });
    expect(mapProfileToView(create(ProfileSchema, { id: "prof-1" })).area).toBe("");
  });

  it("maps the disabled flag", () => {
    expect(mapProfileToView(create(ProfileSchema, { id: "prof-1", disabled: true })).disabled).toBe(true);
    expect(mapProfileToView(create(ProfileSchema, { id: "prof-1" })).disabled).toBe(false);
  });
});

describe("emptyProfileView", () => {
  it("does not require follow approval", () => {
    expect(emptyProfileView("prof-1").followApprovalRequired).toBe(false);
  });

  it("has a zeroed bodyStats", () => {
    expect(emptyProfileView("prof-1").bodyStats).toEqual({ heightCm: 0, bust: 0, waist: 0, hip: 0, cup: "" });
  });
});

describe("profileViewToSavePayload / buildSaveProfileRequest", () => {
  it("carries the litlink sns link through the save request", () => {
    const view = emptyProfileView("prof-1");
    view.snsLinks.litlink = "https://lit.link/yuna";

    const request = buildSaveProfileRequest(profileViewToSavePayload(view));

    expect(request.snsLinks.litlink).toBe("https://lit.link/yuna");
  });

  it("round-trips bodyStats and cityheaven through the save request", () => {
    const view = emptyProfileView("prof-1");
    view.bodyStats = { heightCm: 158, bust: 88, waist: 58, hip: 86, cup: "D" };
    view.snsLinks.cityheaven = "https://www.cityheaven.net/example/";

    const payload = profileViewToSavePayload(view);
    const request = buildSaveProfileRequest(payload);

    expect(request.bodyStats).toEqual({ heightCm: 158, bustCm: 88, waistCm: 58, hipCm: 86, cup: "D" });
    expect(request.snsLinks.cityheaven).toBe("https://www.cityheaven.net/example/");
  });

  it("carries the follow approval flag from the view to the save request", () => {
    const view = { ...emptyProfileView("prof-1"), followApprovalRequired: true };

    expect(profileViewToSavePayload(view).followApprovalRequired).toBe(true);
    expect(buildSaveProfileRequest(profileViewToSavePayload(view)).followApprovalRequired).toBe(true);
  });

  it.each([true, false])("passes followApprovalRequired=%s through to the save request unchanged", (value) => {
    expect(buildSaveProfileRequest({ displayName: "ゆな", followApprovalRequired: value }).followApprovalRequired).toBe(value);
  });
});

describe("main area in the save request", () => {
  it("carries the prefecture and the area from the view to the save request", () => {
    const view = { ...emptyProfileView("prof-1"), displayName: "Coco", prefecture: "大阪府", area: "梅田" };

    expect(buildSaveProfileRequest(profileViewToSavePayload(view))).toMatchObject({ prefecture: "大阪府", area: "梅田" });
  });
});

describe("summaryToView", () => {
  it("maps every field and the role number", () => {
    const view = summaryToView(
      create(ProfileSummarySchema, { profileId: "p-1", username: "rin", displayName: "りん", avatarUrl: "https://cdn.example/a.png", isPrivate: true, role: 2, industry: "デリヘル" })
    );

    expect(view).toEqual({ profileId: "p-1", username: "rin", displayName: "りん", avatarUrl: "https://cdn.example/a.png", isPrivate: true, role: "cast", industry: "デリヘル" });
  });

  it("reads an absent industry as an empty string", () => {
    expect(summaryToView(create(ProfileSummarySchema, { profileId: "p-3" })).industry).toBe("");
  });

  it("reads an unknown role as null", () => {
    expect(summaryToView(create(ProfileSummarySchema, { profileId: "p-2", role: 0 })).role).toBeNull();
  });
});
