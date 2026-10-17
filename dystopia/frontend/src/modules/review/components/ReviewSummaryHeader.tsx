import { RatingStars } from "@/components/ui/rating-stars";
import type { RatingSummary } from "../types";

export function ReviewSummaryHeader({ summary }: { summary: RatingSummary }) {
  const average = summary.averageRating;

  return (
    <section aria-label="利用の満足度" className="flex items-center gap-5 border-b border-border px-4 py-4">
      <div className="flex min-w-16 flex-col items-center gap-1">
        <p className="text-4xl font-bold leading-none text-text-primary">{average === null ? "—" : average.toFixed(1)}</p>
        {average === null ? (
          <p className="text-xs text-text-secondary">未評価</p>
        ) : (
          <RatingStars value={Math.round(average)} className="text-sm" />
        )}
      </div>
      <div className="text-sm">
        <p className="font-bold text-text-primary">利用の満足度（参考評価）</p>
        <p className="text-text-secondary">
          {summary.raterCount}人が評価 · {summary.reviewCount}件の完了済みクチコミ
        </p>
      </div>
    </section>
  );
}
