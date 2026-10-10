import { cn } from "@/lib/utils";

export interface RatingStarsProps {
  value: number;
  className?: string;
}

const MAX_RATING = 5;
const STARS = "★".repeat(MAX_RATING);

export function RatingStars({ value, className }: RatingStarsProps) {
  const rating = Math.min(Math.max(value, 0), MAX_RATING);

  return (
    <span
      role="img"
      aria-label={`${MAX_RATING}段階中 ${rating.toFixed(1)}`}
      className={cn("relative inline-block whitespace-nowrap leading-none text-text-muted", className)}
    >
      <span aria-hidden="true">{STARS}</span>
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 overflow-hidden text-warning"
        style={{ width: `${(rating / MAX_RATING) * 100}%` }}
      >
        {STARS}
      </span>
    </span>
  );
}
