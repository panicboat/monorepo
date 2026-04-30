import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-neutral-900 text-text-inverted hover:bg-neutral-900/80",
        secondary:
          "border-transparent bg-surface-secondary text-text-primary hover:bg-neutral-200/80",
        destructive:
          "border-transparent bg-error text-text-inverted hover:bg-error/80",
        outline: "text-text-primary border-border",
        success:
          "border-transparent bg-success text-text-inverted hover:bg-success/80",
        warning:
          "border-transparent bg-warning text-text-inverted hover:bg-warning/80",
        info:
          "border-transparent bg-info text-text-inverted hover:bg-info/80",
        cast:
          "border-transparent bg-role-cast text-text-inverted hover:bg-role-cast-hover",
        guest:
          "border-transparent bg-role-guest text-text-inverted hover:bg-role-guest-hover",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
