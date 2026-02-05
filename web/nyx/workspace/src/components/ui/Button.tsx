import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-neutral-900 text-text-inverted hover:bg-neutral-900/90",
        destructive:
          "bg-error text-text-inverted hover:bg-error/90",
        outline:
          "border border-border bg-surface hover:bg-surface-secondary hover:text-text-primary",
        secondary:
          "bg-surface-secondary text-text-primary hover:bg-neutral-200/80",
        ghost: "hover:bg-surface-secondary hover:text-text-primary",
        link: "text-text-primary underline-offset-4 hover:underline",
        cast:
          "bg-role-cast text-text-inverted hover:bg-role-cast-hover shadow-md shadow-role-cast-shadow",
        guest:
          "bg-role-guest text-text-inverted hover:bg-role-guest-hover shadow-md shadow-role-guest-shadow",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
