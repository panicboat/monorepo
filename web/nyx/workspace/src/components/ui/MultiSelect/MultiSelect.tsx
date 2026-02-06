"use client";

import { ReactNode } from "react";
import { X } from "lucide-react";

export interface MultiSelectItem {
  id: string;
  name: string;
}

export interface MultiSelectProps<T extends MultiSelectItem> {
  /** All available items */
  items: T[];
  /** Currently selected item IDs */
  selectedIds: string[];
  /** Callback when selection changes */
  onChange: (ids: string[]) => void;
  /** Maximum number of selections allowed */
  maxSelections?: number;
  /** Loading state */
  loading?: boolean;
  /** Help text template with placeholders: {count}, {max} */
  helpText?: string;
  /** Custom render for selected tag */
  renderSelectedTag?: (item: T, onRemove: () => void) => ReactNode;
  /** Custom render for option button */
  renderOption?: (item: T, isSelected: boolean, isDisabled: boolean, onToggle: () => void) => ReactNode;
  /** Icon to show in selected tags */
  tagIcon?: ReactNode;
  /** Color variant */
  variant?: "cast" | "guest" | "neutral";
}

/**
 * Reusable multi-select component with customizable rendering.
 * Supports tags display, max selections, and custom item rendering.
 */
export function MultiSelect<T extends MultiSelectItem>({
  items,
  selectedIds,
  onChange,
  maxSelections = 3,
  loading = false,
  helpText,
  renderSelectedTag,
  renderOption,
  tagIcon,
  variant = "cast",
}: MultiSelectProps<T>) {
  const selectedItems = items.filter((item) => selectedIds.includes(item.id));

  const handleToggle = (item: T) => {
    if (selectedIds.includes(item.id)) {
      onChange(selectedIds.filter((id) => id !== item.id));
    } else if (selectedIds.length < maxSelections) {
      onChange([...selectedIds, item.id]);
    }
  };

  const handleRemove = (id: string) => {
    onChange(selectedIds.filter((i) => i !== id));
  };

  // Color variants
  const variantClasses = {
    cast: {
      tag: "bg-role-cast-light text-role-cast-hover",
      tagHover: "hover:bg-role-cast-light",
      selected: "bg-role-cast text-white shadow-sm",
      unselected: "bg-surface-secondary text-text-secondary hover:bg-neutral-200",
      disabled: "bg-surface-secondary text-text-muted cursor-not-allowed",
      spinner: "border-role-cast",
    },
    guest: {
      tag: "bg-role-guest-light text-role-guest-hover",
      tagHover: "hover:bg-role-guest-light",
      selected: "bg-role-guest text-white shadow-sm",
      unselected: "bg-surface-secondary text-text-secondary hover:bg-neutral-200",
      disabled: "bg-surface-secondary text-text-muted cursor-not-allowed",
      spinner: "border-role-guest",
    },
    neutral: {
      tag: "bg-surface-secondary text-text-secondary",
      tagHover: "hover:bg-surface-secondary",
      selected: "bg-text-primary text-white shadow-sm",
      unselected: "bg-surface-secondary text-text-secondary hover:bg-neutral-200",
      disabled: "bg-surface-secondary text-text-muted cursor-not-allowed",
      spinner: "border-text-primary",
    },
  };

  const colors = variantClasses[variant];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className={`h-5 w-5 animate-spin rounded-full border-2 ${colors.spinner} border-t-transparent`} />
      </div>
    );
  }

  const defaultRenderSelectedTag = (item: T, onRemove: () => void) => (
    <span
      key={item.id}
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm ${colors.tag}`}
    >
      {tagIcon}
      {item.name}
      <button
        type="button"
        onClick={onRemove}
        className={`ml-1 rounded-full p-0.5 ${colors.tagHover}`}
        aria-label={`${item.name}を削除`}
      >
        <X size={12} aria-hidden="true" />
      </button>
    </span>
  );

  const defaultRenderOption = (item: T, isSelected: boolean, isDisabled: boolean, onToggle: () => void) => (
    <button
      key={item.id}
      type="button"
      onClick={onToggle}
      disabled={isDisabled}
      className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
        isSelected
          ? colors.selected
          : isDisabled
          ? colors.disabled
          : colors.unselected
      }`}
      aria-pressed={isSelected}
    >
      {item.name}
    </button>
  );

  const formattedHelpText = helpText
    ?.replace("{count}", String(selectedIds.length))
    .replace("{max}", String(maxSelections));

  return (
    <div className="space-y-3">
      {/* Selected items as tags */}
      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-2" role="list" aria-label="選択済みアイテム">
          {selectedItems.map((item) =>
            renderSelectedTag
              ? renderSelectedTag(item, () => handleRemove(item.id))
              : defaultRenderSelectedTag(item, () => handleRemove(item.id))
          )}
        </div>
      )}

      {/* All options */}
      <div className="flex flex-wrap gap-2" role="listbox" aria-multiselectable="true">
        {items.map((item) => {
          const isSelected = selectedIds.includes(item.id);
          const isDisabled = !isSelected && selectedIds.length >= maxSelections;

          return renderOption
            ? renderOption(item, isSelected, isDisabled, () => handleToggle(item))
            : defaultRenderOption(item, isSelected, isDisabled, () => handleToggle(item));
        })}
      </div>

      {/* Help text */}
      {formattedHelpText && (
        <p className="text-[10px] text-text-muted">{formattedHelpText}</p>
      )}
    </div>
  );
}
