/**
 * Theme Configuration
 *
 * TypeScript reference for design tokens defined in globals.css.
 * Use this for programmatic access to design tokens in components.
 *
 * Usage:
 *   import { colors } from '@/config/theme';
 *   style={{ color: colors.role.cast.default }}
 */

/**
 * Color tokens that reference CSS custom properties.
 * These provide type-safe access to design tokens.
 */
export const colors = {
  // Role - Cast (pink)
  role: {
    cast: {
      default: "var(--color-role-cast)",
      hover: "var(--color-role-cast-hover)",
      light: "var(--color-role-cast-light)",
      shadow: "var(--color-role-cast-shadow)",
    },
    guest: {
      default: "var(--color-role-guest)",
      hover: "var(--color-role-guest-hover)",
      light: "var(--color-role-guest-light)",
      shadow: "var(--color-role-guest-shadow)",
    },
  },

  // Accent (neutral emphasis)
  accent: {
    default: "var(--color-accent)",
    hover: "var(--color-accent-hover)",
    light: "var(--color-accent-light)",
  },

  // Semantic
  surface: {
    default: "var(--color-surface)",
    secondary: "var(--color-surface-secondary)",
  },
  border: {
    default: "var(--color-border)",
    secondary: "var(--color-border-secondary)",
  },
  text: {
    primary: "var(--color-text-primary)",
    secondary: "var(--color-text-secondary)",
    muted: "var(--color-text-muted)",
  },

  // Status
  success: {
    default: "var(--color-success)",
    hover: "var(--color-success-hover)",
  },
  warning: {
    default: "var(--color-warning)",
    hover: "var(--color-warning-hover)",
  },
  error: {
    default: "var(--color-error)",
    hover: "var(--color-error-hover)",
  },
  info: {
    default: "var(--color-info)",
    hover: "var(--color-info-hover)",
  },
} as const;

/**
 * Tailwind utility class mappings for design tokens.
 * Use these when you need Tailwind classes instead of inline styles.
 */
export const tailwindColors = {
  // Role - Cast
  roleCast: "bg-role-cast",
  roleCastHover: "hover:bg-role-cast-hover",
  roleCastText: "text-role-cast",
  roleCastLight: "bg-role-cast-light",
  roleCastShadow: "shadow-role-cast-shadow",

  // Role - Guest
  roleGuest: "bg-role-guest",
  roleGuestHover: "hover:bg-role-guest-hover",
  roleGuestText: "text-role-guest",
  roleGuestLight: "bg-role-guest-light",
  roleGuestShadow: "shadow-role-guest-shadow",

  // Accent
  accent: "bg-accent",
  accentHover: "hover:bg-accent-hover",
  accentText: "text-accent",
  accentLight: "bg-accent-light",

  // Surface
  surface: "bg-surface",
  surfaceSecondary: "bg-surface-secondary",

  // Border
  border: "border-border",
  borderSecondary: "border-border-secondary",

  // Text
  textPrimary: "text-text-primary",
  textSecondary: "text-text-secondary",
  textMuted: "text-text-muted",

  // Status
  success: "text-success",
  successBg: "bg-success",
  warning: "text-warning",
  warningBg: "bg-warning",
  error: "text-error",
  errorBg: "bg-error",
  info: "text-info",
  infoBg: "bg-info",
} as const;

export type Colors = typeof colors;
export type TailwindColors = typeof tailwindColors;
