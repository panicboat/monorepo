import type { KarteAggregate } from "../types";

export function KarteAggregateHeader({ aggregate }: { aggregate: KarteAggregate }) {
  if (aggregate.count === 0) {
    return <div className="px-4 py-3 text-sm text-muted-foreground">カルテはまだありません</div>;
  }
  return (
    <div className="px-4 py-3 text-sm">
      <span className="font-medium">{aggregate.count} 件</span>
      <span className="ml-2 text-muted-foreground">
        平均 ★{aggregate.avgRating.toFixed(1)}
      </span>
    </div>
  );
}
