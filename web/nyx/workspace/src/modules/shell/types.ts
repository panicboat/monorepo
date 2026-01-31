/**
 * Shell domain types
 * Navigation and layout
 */

export type NavPosition = "top" | "bottom";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon?: string;
  badge?: number;
  active?: boolean;
}

export interface NavConfig {
  position: NavPosition;
  items: NavItem[];
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}
