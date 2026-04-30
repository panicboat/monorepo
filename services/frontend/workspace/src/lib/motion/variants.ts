import type { Variants, Transition } from "motion/react";

// ===== Transitions =====

export const springTransition: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 30,
};

export const smoothTransition: Transition = {
  type: "tween",
  ease: "easeInOut",
  duration: 0.3,
};

export const popTransition: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 10,
};

export const fastTransition: Transition = {
  type: "tween",
  duration: 0.2,
};

// ===== Fade Variants =====

export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

// ===== Scale Fade Variants (for toasts, modals) =====

export const scaleFadeVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

// Variant with upward exit (for toast notifications)
export const toastVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -10, scale: 0.95 },
};

// ===== Slide Up Fade Variants (for list items, cards) =====

export const slideUpFadeVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

// Larger slide distance variant
export const slideUpFadeLargeVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

// ===== Slide Up Variants (for drawers, sheets) =====

export const slideUpVariants: Variants = {
  hidden: { y: "100%" },
  visible: { y: 0 },
  exit: { y: "100%" },
};

// ===== Overlay Variants =====

export const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 0.5 },
  exit: { opacity: 0 },
};

export const overlayFullVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

// ===== Pop Variants (for likes, reactions) =====

export const popVariants: Variants = {
  initial: { scale: 0.6 },
  animate: { scale: 1 },
};

// ===== List Container Variants (for staggered animations) =====

export const listContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

export const listItemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};
