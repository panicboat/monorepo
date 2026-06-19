import Link from "next/link";
import { cn } from "@/lib/utils";

export interface BrandMarkProps {
  className?: string;
}

// dystopia.city wordmark, rendered as brand-gradient text. Links to home.
export function BrandMark({ className }: BrandMarkProps) {
  return (
    <Link
      href="/"
      aria-label="dystopia.city ホーム"
      className={cn(
        "bg-gradient-brand bg-clip-text font-bold tracking-tight text-transparent",
        className
      )}
    >
      dystopia.city
    </Link>
  );
}
