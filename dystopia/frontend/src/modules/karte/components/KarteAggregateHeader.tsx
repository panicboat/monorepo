import { RatingStars } from "@/components/ui/rating-stars";
import type { ReliabilitySummary } from "../types";

export function KarteAggregateHeader({ reliability }: { reliability: ReliabilitySummary }) {
  if (reliability.averageRating === null) {
    return <div className="px-4 py-3 text-sm text-text-secondary">未評価（完了したカルテはまだありません）</div>;
  }
  return (
    <div className="flex flex-col gap-1 px-4 py-3 text-sm">
      <p className="text-xs text-text-secondary">予約・接客の信頼性（参考評価）</p>
      <div className="flex items-center gap-2">
        <span className="text-xl font-bold">{reliability.averageRating.toFixed(1)} / 5.0</span>
        <RatingStars value={reliability.averageRating} />
      </div>
      <p className="text-xs text-text-secondary">
        {reliability.raterCount}人が評価 · {reliability.karteCount}件の完了済みカルテ
      </p>
    </div>
  );
}
