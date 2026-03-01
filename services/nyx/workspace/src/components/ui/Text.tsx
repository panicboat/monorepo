import { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const textVariants = cva("", {
  variants: {
    size: {
      xs: "text-[10px]",
      sm: "text-xs",
      base: "text-sm",
      lg: "text-base",
      xl: "text-lg",
      "2xl": "text-xl",
      "3xl": "text-2xl",
    },
    weight: {
      normal: "font-normal",
      medium: "font-medium",
      semibold: "font-semibold",
      bold: "font-bold",
    },
    color: {
      primary: "text-text-primary",
      secondary: "text-text-secondary",
      muted: "text-text-muted",
      inverted: "text-text-inverted",
      accent: "text-accent",
      cast: "text-role-cast",
      guest: "text-role-guest",
      success: "text-success",
      warning: "text-warning",
      error: "text-error",
      info: "text-info",
    },
    align: {
      left: "text-left",
      center: "text-center",
      right: "text-right",
    },
  },
  defaultVariants: {
    size: "base",
    weight: "normal",
    color: "primary",
    align: "left",
  },
});

type TextProps = {
  children: ReactNode;
  as?: "p" | "span" | "div" | "label" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  className?: string;
} & VariantProps<typeof textVariants>;

export function Text({
  children,
  as: Component = "span",
  size,
  weight,
  color,
  align,
  className,
}: TextProps) {
  return (
    <Component className={cn(textVariants({ size, weight, color, align }), className)}>
      {children}
    </Component>
  );
}
