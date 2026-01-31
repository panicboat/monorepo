/**
 * Theme Configuration
 *
 * TypeScript reference for design tokens defined in globals.css.
 * Use this for programmatic access to design tokens in components.
 *
 * Usage:
 *   import { colors } from '@/config/theme';
 *   style={{ color: colors.brand.primary }}
 */

/**
 * Color tokens that reference CSS custom properties.
 * These provide type-safe access to design tokens.
 */
export const colors = {
  // Brand
  brand: {
    primary: "var(--color-brand-primary)",
    primaryHover: "var(--color-brand-primary-hover)",
    secondary: "var(--color-brand-secondary)",
    secondaryHover: "var(--color-brand-secondary-hover)",
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

  // Role
  role: {
    guest: "var(--color-role-guest)",
    cast: "var(--color-role-cast)",
  },
} as const;

/**
 * Tailwind utility class mappings for design tokens.
 * Use these when you need Tailwind classes instead of inline styles.
 */
export const tailwindColors = {
  // Brand
  brand: "bg-brand",
  brandHover: "hover:bg-brand-hover",
  brandText: "text-brand",
  brandCast: "bg-brand-cast",
  brandCastHover: "hover:bg-brand-cast-hover",
  brandCastText: "text-brand-cast",

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

  // Role
  roleGuest: "text-role-guest",
  roleGuestBg: "bg-role-guest",
  roleCast: "text-role-cast",
  roleCastBg: "bg-role-cast",
} as const;

export type Colors = typeof colors;
export type TailwindColors = typeof tailwindColors;
