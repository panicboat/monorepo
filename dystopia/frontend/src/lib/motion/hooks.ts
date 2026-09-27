import { useReducedMotion } from "motion/react";
import type { Variants, Transition, MotionProps } from "motion/react";
import {
  fadeVariants,
  scaleFadeVariants,
  toastVariants,
  slideUpFadeVariants,
  slideUpFadeLargeVariants,
  slideUpVariants,
  overlayVariants,
  overlayFullVariants,
  listItemVariants,
  springTransition,
  smoothTransition,
} from "./variants";

type MotionPropsWithVariants = Pick<
  MotionProps,
  "initial" | "animate" | "exit" | "variants" | "transition" | "layout"
>;

export function useMotionProps(
  variants: Variants,
  options?: {
    layout?: boolean;
    transition?: Transition;
  }
): MotionPropsWithVariants {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return {
      initial: false,
      animate: "visible",
    };
  }

  return {
    initial: "hidden",
    animate: "visible",
    exit: "exit",
    variants,
    transition: options?.transition,
    layout: options?.layout ?? false,
  };
}

export function useFadeAnimation(options?: { transition?: Transition }) {
  return useMotionProps(fadeVariants, {
    transition: options?.transition ?? smoothTransition,
  });
}

export function useScaleFadeAnimation(options?: { transition?: Transition }) {
  return useMotionProps(scaleFadeVariants, {
    transition: options?.transition ?? springTransition,
  });
}

export function useToastAnimation() {
  return useMotionProps(toastVariants, {
    transition: springTransition,
  });
}

export function useSlideUpFadeAnimation(options?: {
  large?: boolean;
  layout?: boolean;
}) {
  const variants = options?.large
    ? slideUpFadeLargeVariants
    : slideUpFadeVariants;
  return useMotionProps(variants, {
    layout: options?.layout,
    transition: smoothTransition,
  });
}

export function useSlideUpAnimation(options?: { transition?: Transition }) {
  return useMotionProps(slideUpVariants, {
    transition: options?.transition ?? springTransition,
  });
}

export function useOverlayAnimation(options?: { full?: boolean }) {
  const variants = options?.full ? overlayFullVariants : overlayVariants;
  return useMotionProps(variants, {
    transition: smoothTransition,
  });
}

export function useListItemAnimation(options?: { layout?: boolean }) {
  return useMotionProps(listItemVariants, {
    layout: options?.layout,
    transition: smoothTransition,
  });
}
