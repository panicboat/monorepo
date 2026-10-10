import { RatingStars } from "@/components/ui/rating-stars";
import type { KarteAggregate } from "../types";

export function KarteAggregateHeader({ aggregate }: { aggregate: KarteAggregate }) {
  if (aggregate.count === 0) {
    return <div className="px-4 py-3 text-sm text-muted-foreground">カルテはまだありません</div>;
  }
  return (
    <div className="flex items-center px-4 py-3 text-sm">
      <span className="font-medium">{aggregate.count} 件</span>
      <span className="mx-1 text-muted-foreground">/</span>
      <span className="mr-1.5 text-muted-foreground">平均</span>
      <RatingStars value={aggregate.avgRating} />
      <span className="ml-1.5 text-muted-foreground">{aggregate.avgRating.toFixed(1)}</span>
    </div>
  );
}
