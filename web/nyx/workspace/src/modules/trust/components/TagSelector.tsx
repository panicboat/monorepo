"use client";

import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface TagSelectorProps {
  suggestions: string[];
  appliedTagNames: string[];
  onAdd: (tagName: string) => void;
  loading?: boolean;
}

export function TagSelector({
  suggestions,
  appliedTagNames,
  onAdd,
  loading,
}: TagSelectorProps) {
  const [input, setInput] = useState("");

  const handleAdd = () => {
    const name = input.trim();
    if (!name) return;
    onAdd(name);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  const unappliedSuggestions = suggestions.filter(
    (s) => !appliedTagNames.includes(s)
  );

  return (
    <div className="space-y-3">
      {/* Input for tag name */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted font-bold pointer-events-none">
            #
          </span>
          <Input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="タグを追加..."
            disabled={loading}
            className="pl-7 pr-4 font-bold focus-visible:ring-role-cast"
          />
        </div>
        <Button
          type="button"
          onClick={handleAdd}
          disabled={!input.trim() || loading}
          size="icon"
          className="w-12 h-10 rounded-xl bg-neutral-900 text-white disabled:bg-surface-secondary disabled:text-text-muted"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus size={20} />}
        </Button>
      </div>

      {/* Suggestions from past usage */}
      {unappliedSuggestions.length > 0 && (
        <div>
          <p className="text-xs font-bold text-text-muted mb-2 uppercase">
            Suggestions
          </p>
          <div className="flex flex-wrap gap-2">
            {unappliedSuggestions.map((tagName) => (
              <Button
                key={tagName}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onAdd(tagName)}
                disabled={loading}
                className="h-7 rounded-full px-3 text-xs font-medium transition-colors border-border bg-surface text-text-secondary hover:border-role-cast-light hover:text-role-cast hover:bg-role-cast-lighter"
              >
                #{tagName}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
