/**
 * Nyx Design Tokens
 *
 * Centralized design system configuration.
 * Use these tokens for consistent styling across the application.
 */

/**
 * Color palette
 */
export const colors = {
  // Brand colors
  brand: {
    primary: "pink-500",
    primaryHover: "pink-600",
    secondary: "slate-900",
    secondaryHover: "slate-800",
  },

  // Cast theme (pink-based)
  cast: {
    accent: "pink-500",
    accentHover: "pink-600",
    gradient: {
      from: "pink-500",
      to: "rose-500",
    },
  },

  // Guest theme (purple-based)
  guest: {
    accent: "purple-500",
    accentHover: "purple-600",
    gradient: {
      from: "pink-400",
      to: "purple-500",
    },
  },

  // Text colors
  text: {
    primary: "slate-900",
    secondary: "slate-500",
    tertiary: "slate-400",
    inverse: "white",
  },

  // Background colors
  bg: {
    primary: "white",
    secondary: "slate-50",
    tertiary: "slate-100",
  },

  // Border colors
  border: {
    light: "slate-100",
    medium: "slate-200",
    dark: "slate-300",
  },

  // Status colors
  status: {
    online: "green-500",
    offline: "slate-400",
    busy: "amber-500",
    success: "green-500",
    error: "red-500",
    warning: "amber-500",
  },
} as const;

/**
 * Typography scale
 */
export const typography = {
  // Font sizes (Tailwind class names)
  fontSize: {
    "3xs": "text-[8px]",   // Use sparingly
    "2xs": "text-[10px]",  // Badges, labels
    xs: "text-xs",         // 12px - Small text
    sm: "text-sm",         // 14px - Body small
    base: "text-base",     // 16px - Body
    lg: "text-lg",         // 18px - Headings
    xl: "text-xl",         // 20px
    "2xl": "text-2xl",     // 24px
    "3xl": "text-3xl",     // 30px
  },

  // Font weights
  fontWeight: {
    normal: "font-normal",
    medium: "font-medium",
    semibold: "font-semibold",
    bold: "font-bold",
  },
} as const;

/**
 * Spacing scale
 */
export const spacing = {
  // Component padding
  card: {
    sm: "p-3",
    md: "p-4",
    lg: "p-6",
  },

  // Section gaps
  section: {
    sm: "gap-4",
    md: "gap-6",
    lg: "gap-8",
  },

  // Button padding
  button: {
    sm: "px-3 py-1.5",
    md: "px-4 py-2",
    lg: "px-6 py-3",
  },
} as const;

/**
 * Border radius
 */
export const radius = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  full: "rounded-full",
  // Semantic
  button: "rounded-xl",
  card: "rounded-2xl",
  input: "rounded-lg",
  badge: "rounded-full",
  avatar: "rounded-full",
} as const;

/**
 * Shadows
 */
export const shadows = {
  sm: "shadow-sm",
  md: "shadow-md",
  lg: "shadow-lg",
  // Brand shadows
  brand: "shadow-md shadow-pink-200",
  brandHover: "shadow-lg shadow-pink-300",
  // Card shadows
  card: "shadow-sm",
  cardHover: "shadow-md",
} as const;

/**
 * Z-index scale
 */
export const zIndex = {
  base: "z-0",
  dropdown: "z-10",
  sticky: "z-20",
  fixed: "z-30",
  modal: "z-40",
  popover: "z-50",
  toast: "z-[100]",
} as const;

/**
 * Transitions
 */
export const transitions = {
  fast: "transition-all duration-150",
  normal: "transition-all duration-200",
  slow: "transition-all duration-300",
} as const;

/**
 * Combined theme export
 */
export const theme = {
  colors,
  typography,
  spacing,
  radius,
  shadows,
  zIndex,
  transitions,
} as const;

export default theme;
