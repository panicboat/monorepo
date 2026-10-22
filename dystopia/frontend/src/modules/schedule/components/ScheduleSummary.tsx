import Link from "next/link";
import { industryIcon } from "@/modules/profile/lib/constants";
import { crossesMidnight, formatScheduleDay } from "@/modules/schedule/lib/dates";

export interface ScheduleSummaryProps {
  workDate: string;
  startTime: string;
  endTime: string;
  industry: string;
  href?: string;
}

const FRAME = "mt-2 block rounded-xl border border-border bg-surface p-3";

export function ScheduleSummary({ workDate, startTime, endTime, industry, href }: ScheduleSummaryProps) {
  const icon = industryIcon(industry);
  const content = (
    <>
      <span className="block text-xs font-bold tracking-wide text-text-secondary">予定</span>
      <p className="mt-1 text-lg font-bold tabular-nums text-text-primary">
        {startTime}〜{endTime}
        {crossesMidnight(startTime, endTime) && <span className="ml-1 text-sm font-normal text-text-secondary">翌日</span>}
      </p>
      <p className="flex items-center gap-1 text-xs text-text-secondary">
        {icon && (
          <span role="img" aria-label={industry} title={industry}>
            {icon}
          </span>
        )}
        <span>{formatScheduleDay(workDate)}</span>
      </p>
    </>
  );

  return href ? (
    <Link href={href} className={`${FRAME} hover:border-accent/60`}>
      {content}
    </Link>
  ) : (
    <div className={FRAME}>{content}</div>
  );
}
