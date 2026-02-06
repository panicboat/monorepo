import { ArrowUpRight, CheckCircle2, Heart, Users, Wallet } from "lucide-react";

interface EarningsSummaryProps {
  stats: {
    earningsToday: number;
    earningsTodayChange: number;
    earningsThisWeek: number;
    earningsThisMonth: number;
    reservationsThisMonth: number;
    promiseRate: number;
    followers: number;
  };
}

export const EarningsSummary = ({ stats }: EarningsSummaryProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "JPY",
    }).format(amount);
  };

  return (
    <div className="space-y-4">
      <div className="bg-surface rounded-xl p-4 shadow-sm border border-border">
        <h2 className="text-sm font-semibold text-text-secondary mb-2 flex items-center gap-2">
          <Wallet className="w-4 h-4" />
          本日の売上
        </h2>
        <div className="flex items-end justify-between">
          <div className="text-3xl font-bold text-text-primary tracking-tight">
            {formatCurrency(stats.earningsToday)}
          </div>
          <div
            className={`flex items-center text-xs font-bold px-2 py-1 rounded-full ${
              stats.earningsTodayChange >= 0
                ? "text-success-hover bg-success-lighter"
                : "text-error-hover bg-error-lighter"
            }`}
          >
            <ArrowUpRight
              className={`w-3 h-3 mr-0.5 ${stats.earningsTodayChange < 0 ? "rotate-90" : ""}`}
            />
            {stats.earningsTodayChange > 0 ? "+" : ""}
            {stats.earningsTodayChange}%
            <span className="ml-1 font-medium text-text-secondary opacity-80">
              vs 昨日
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface rounded-xl p-4 shadow-sm border border-border">
          <h3 className="text-xs font-semibold text-text-secondary mb-1">
            今週の売上
          </h3>
          <div className="text-lg font-bold text-text-primary">
            {formatCurrency(stats.earningsThisWeek)}
          </div>
        </div>
        <div className="bg-surface rounded-xl p-4 shadow-sm border border-border">
          <h3 className="text-xs font-semibold text-text-secondary mb-1">
            今月の売上
          </h3>
          <div className="text-lg font-bold text-text-primary">
            {formatCurrency(stats.earningsThisMonth)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-surface-secondary rounded-lg p-3 text-center border border-border">
          <div className="flex justify-center mb-1 text-role-cast">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="text-xs text-text-secondary mb-0.5">誓約確定数</div>
          <div className="text-base font-bold text-text-primary">
            {stats.reservationsThisMonth}
          </div>
        </div>
        <div className="bg-surface-secondary rounded-lg p-3 text-center border border-border">
          <div className="flex justify-center mb-1 text-success">
            <Heart className="w-5 h-5" />
          </div>
          <div className="text-xs text-text-secondary mb-0.5">誓約履行率</div>
          <div className="text-base font-bold text-text-primary">
            {stats.promiseRate}%
          </div>
        </div>
        <div className="bg-surface-secondary rounded-lg p-3 text-center border border-border">
          <div className="flex justify-center mb-1 text-info">
            <Users className="w-5 h-5" />
          </div>
          <div className="text-xs text-text-secondary mb-0.5">フォロワー</div>
          <div className="text-base font-bold text-text-primary">
            {stats.followers}
          </div>
        </div>
      </div>
    </div>
  );
};
