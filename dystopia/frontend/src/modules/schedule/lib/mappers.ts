import type { Schedule } from "@/stub/schedule/v1/schedule_service_pb";
import type { ScheduleView } from "@/modules/schedule/types";

export function mapScheduleToView(p: Schedule): ScheduleView {
  return {
    accountId: p.accountId || "",
    workDate: p.workDate || "",
    startTime: p.startTime || "",
    endTime: p.endTime || "",
  };
}
