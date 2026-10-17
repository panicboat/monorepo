import { cn } from "@/lib/utils";
import type { KarteStatus } from "../types";

export function KarteStatusBadge({ status }: { status: KarteStatus }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-xs font-bold",
        status === "open" ? "border-warning/50 bg-warning/10 text-warning" : "border-success-text/50 bg-success-text/10 text-success-text"
      )}
    >
      {status === "open" ? "記録中" : "完了"}
    </span>
  );
}
