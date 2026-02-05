import { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const stackVariants = cva("flex", {
  variants: {
    direction: {
      row: "flex-row",
      column: "flex-col",
      "row-reverse": "flex-row-reverse",
      "column-reverse": "flex-col-reverse",
    },
    gap: {
      none: "gap-0",
      xs: "gap-1",
      sm: "gap-2",
      md: "gap-4",
      lg: "gap-6",
      xl: "gap-8",
      "2xl": "gap-12",
    },
    align: {
      start: "items-start",
      center: "items-center",
      end: "items-end",
      stretch: "items-stretch",
      baseline: "items-baseline",
    },
    justify: {
      start: "justify-start",
      center: "justify-center",
      end: "justify-end",
      between: "justify-between",
      around: "justify-around",
      evenly: "justify-evenly",
    },
    wrap: {
      wrap: "flex-wrap",
      nowrap: "flex-nowrap",
      "wrap-reverse": "flex-wrap-reverse",
    },
  },
  defaultVariants: {
    direction: "column",
    gap: "md",
    align: "stretch",
    justify: "start",
    wrap: "nowrap",
  },
});

type StackProps = {
  children: ReactNode;
  as?: "div" | "section" | "article" | "main" | "aside" | "nav" | "ul" | "ol";
  className?: string;
} & VariantProps<typeof stackVariants>;

export function Stack({
  children,
  as: Component = "div",
  direction,
  gap,
  align,
  justify,
  wrap,
  className,
}: StackProps) {
  return (
    <Component
      className={cn(stackVariants({ direction, gap, align, justify, wrap }), className)}
    >
      {children}
    </Component>
  );
}

export function HStack({
  children,
  className,
  ...props
}: Omit<StackProps, "direction">) {
  return (
    <Stack direction="row" className={className} {...props}>
      {children}
    </Stack>
  );
}

export function VStack({
  children,
  className,
  ...props
}: Omit<StackProps, "direction">) {
  return (
    <Stack direction="column" className={className} {...props}>
      {children}
    </Stack>
  );
}
