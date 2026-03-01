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

/**
 * Returns animation props respecting user's reduced motion preference.
 * When reduced motion is preferred, animations are disabled.
 */
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

// ===== Preset Hooks =====

/**
 * Simple fade animation
 */
export function useFadeAnimation(options?: { transition?: Transition }) {
  return useMotionProps(fadeVariants, {
    transition: options?.transition ?? smoothTransition,
  });
}

/**
 * Scale + fade animation (for modals, toasts)
 */
export function useScaleFadeAnimation(options?: { transition?: Transition }) {
  return useMotionProps(scaleFadeVariants, {
    transition: options?.transition ?? springTransition,
  });
}

/**
 * Toast notification animation (slide up + scale + fade)
 */
export function useToastAnimation() {
  return useMotionProps(toastVariants, {
    transition: springTransition,
  });
}

/**
 * Slide up + fade animation (for list items, cards)
 */
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

/**
 * Slide up animation (for drawers, sheets)
 */
export function useSlideUpAnimation(options?: { transition?: Transition }) {
  return useMotionProps(slideUpVariants, {
    transition: options?.transition ?? springTransition,
  });
}

/**
 * Overlay animation (for backdrops)
 */
export function useOverlayAnimation(options?: { full?: boolean }) {
  const variants = options?.full ? overlayFullVariants : overlayVariants;
  return useMotionProps(variants, {
    transition: smoothTransition,
  });
}

/**
 * List item animation (for staggered lists)
 */
export function useListItemAnimation(options?: { layout?: boolean }) {
  return useMotionProps(listItemVariants, {
    layout: options?.layout,
    transition: smoothTransition,
  });
}
