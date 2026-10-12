import { RatingStars } from "@/components/ui/rating-stars";
import type { KarteAggregate } from "../types";

export function KarteAggregateHeader({ aggregate }: { aggregate: KarteAggregate }) {
  if (aggregate.count === 0) return <div className="border-b border-divider p-5 text-sm text-text-secondary">カルテはまだありません</div>;
  return (
    <section aria-label="予約・接客の信頼性" className="space-y-4 border-b border-divider p-5">
      <div><p className="text-sm font-bold">予約・接客の信頼性</p><div className="mt-2 flex flex-wrap items-center gap-3"><span className="text-sm text-text-secondary">平均</span>{aggregate.avgRating === null ? <span className="text-2xl font-bold text-text-secondary">未評価</span> : <><span className="text-3xl font-bold text-accent">{aggregate.avgRating.toFixed(1)}</span><RatingStars value={aggregate.avgRating} className="text-xl" /><span className="text-xs text-text-secondary">/ 5</span></>}</div></div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-text-secondary"><span>評価したキャスト <strong className="text-text-primary">{aggregate.authorCount}人</strong></span><span>集計対象カルテ <strong className="text-text-primary">{aggregate.ratedCount}件</strong></span><span>カルテ全体 <strong className="text-text-primary">{aggregate.count}件</strong></span></div>
      <p className="text-xs leading-relaxed text-text-secondary">完了した評価付きカルテについて、キャストごとの平均を等しく集計しています。</p>
    </section>
  );
}
