"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type MenuItemProps = {
  icon: LucideIcon;
  iconBgColor?: string;
  iconColor?: string;
  title: string;
  description?: string;
  href?: string;
  onClick?: () => void;
  rightSlot?: ReactNode;
  className?: string;
};

export function MenuItem({
  icon: Icon,
  iconBgColor = "bg-surface-secondary",
  iconColor = "text-text-secondary",
  title,
  description,
  href,
  onClick,
  rightSlot,
  className,
}: MenuItemProps) {
  const content = (
    <>
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center",
            iconBgColor,
            iconColor
          )}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="text-left">
          <p className="text-sm font-bold text-text-primary">{title}</p>
          {description && (
            <p className="text-xs text-text-secondary">{description}</p>
          )}
        </div>
      </div>
      {rightSlot || (
        <ChevronRight className="text-text-muted group-hover:text-text-secondary transition" />
      )}
    </>
  );

  const baseClassName = cn(
    "w-full bg-surface hover:bg-surface-secondary border border-border rounded-xl p-4 flex items-center justify-between group transition shadow-sm",
    className
  );

  if (href) {
    return (
      <Link href={href} className={baseClassName}>
        {content}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={baseClassName}>
      {content}
    </button>
  );
}
