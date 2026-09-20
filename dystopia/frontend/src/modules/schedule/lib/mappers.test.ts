import { describe, expect, it } from "vitest";
import { create } from "@bufbuild/protobuf";
import { ScheduleSchema } from "@/stub/schedule/v1/schedule_service_pb";
import { mapScheduleToView } from "./mappers";

describe("mapScheduleToView", () => {
  it("maps all fields from the proto", () => {
    const proto = create(ScheduleSchema, {
      accountId: "acc-1",
      workDate: "2026-09-20",
      startTime: "20:00",
      endTime: "02:00",
    });

    expect(mapScheduleToView(proto)).toEqual({
      accountId: "acc-1",
      workDate: "2026-09-20",
      startTime: "20:00",
      endTime: "02:00",
    });
  });

  it("defaults missing fields to empty strings", () => {
    const proto = create(ScheduleSchema, {});

    expect(mapScheduleToView(proto)).toEqual({
      accountId: "",
      workDate: "",
      startTime: "",
      endTime: "",
    });
  });
});
