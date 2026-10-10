import Link from "next/link";
import { SEND_RESTRICTION_MESSAGES } from "../lib/send-restriction";
import type { SendRestrictionView } from "../types";

interface SendRestrictionNoticeProps {
  restriction: Exclude<SendRestrictionView, "none">;
  counterpartUsername?: string;
}

export function SendRestrictionNotice({ restriction, counterpartUsername }: SendRestrictionNoticeProps) {
  return (
    <div className="border-t border-border bg-bg px-4 py-4 text-center text-sm text-text-secondary" role="status">
      <p>{SEND_RESTRICTION_MESSAGES[restriction]}</p>
      {restriction === "follow_required" && counterpartUsername && (
        <Link
          href={`/u/${encodeURIComponent(counterpartUsername)}`}
          className="mt-2 inline-block font-bold text-accent hover:underline"
        >
          プロフィールを見る
        </Link>
      )}
    </div>
  );
}
