"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { X, Hash } from "lucide-react";

interface HashtagInputProps {
  value: string[];
  onChange: (hashtags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  className?: string;
}

export function HashtagInput({
  value,
  onChange,
  placeholder = "Add hashtag...",
  maxTags = 10,
  className = "",
}: HashtagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (tag: string) => {
    const cleaned = tag.trim().replace(/^#/, "");
    if (!cleaned) return;
    if (value.length >= maxTags) return;
    if (value.includes(cleaned)) return;
    onChange([...value, cleaned]);
    setInputValue("");
  };

  const removeTag = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Skip during IME composition (Japanese/Chinese input)
    if (e.nativeEvent.isComposing) return;

    if (e.key === "Enter" || e.key === "," || e.key === " ") {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      removeTag(value.length - 1);
    }
  };

  const handleBlur = () => {
    if (inputValue.trim()) {
      addTag(inputValue);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2">
        <Hash size={14} className="text-text-muted" />
        <span className="text-xs font-medium text-text-secondary">Hashtags</span>
        <span className="text-[10px] text-text-muted">({value.length}/{maxTags})</span>
      </div>
      <div
        className="flex flex-wrap gap-2 p-2 bg-surface-secondary rounded-xl min-h-[40px] cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag, index) => (
          <span
            key={index}
            className="inline-flex items-center gap-1 px-2 py-1 bg-accent-light text-accent text-xs font-medium rounded-full"
          >
            #{tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(index);
              }}
              className="hover:bg-accent-light rounded-full p-0.5 transition-colors"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        {value.length < maxTags && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder={value.length === 0 ? placeholder : ""}
            className="flex-1 min-w-[100px] bg-transparent border-0 outline-none text-sm placeholder:text-text-muted"
          />
        )}
      </div>
    </div>
  );
}
