import { X, Plus } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface TagSelectorProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

export const TagSelector = ({ tags, onChange }: TagSelectorProps) => {
  const [input, setInput] = useState("");

  const handleAdd = () => {
    if (!input.trim()) return;
    if (tags.includes(input.trim())) {
      setInput("");
      return;
    }
    onChange([...tags, input.trim()]);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleRemove = (tagToRemove: string) => {
    onChange(tags.filter((t) => t !== tagToRemove));
  };

  const suggestedTags = [
    "EnglishOK",
    "Singer",
    "AnimeLover",
    "Cosplay",
    "Student",
    "Model",
    "Golfer",
  ];

  return (
    <div className="space-y-3">
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
            placeholder="Add a tag..."
            className="pl-7 pr-4 font-bold focus-visible:ring-role-cast"
          />
        </div>
        <Button
          type="button"
          onClick={handleAdd}
          disabled={!input.trim()}
          size="icon"
          className="w-12 h-10 rounded-xl bg-neutral-900 text-white disabled:bg-surface-secondary disabled:text-text-muted"
        >
          <Plus size={20} />
        </Button>
      </div>

      {/* Selected Tags */}
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded-full bg-role-cast-light px-3 py-1.5 text-xs font-bold text-role-cast"
          >
            #{tag}
            <button
              type="button"
              onClick={() => handleRemove(tag)}
              className="ml-1 rounded-full bg-surface/50 p-0.5 hover:bg-surface text-role-cast transition-colors"
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>

      {/* Suggested */}
      <div className="pt-2">
        <p className="text-xs font-bold text-text-muted mb-2 uppercase">
          Suggestions
        </p>
        <div className="flex flex-wrap gap-2">
          {suggestedTags
            .filter((t) => !tags.includes(t))
            .map((tag) => (
              <Button
                key={tag}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onChange([...tags, tag])}
                className="h-7 rounded-full border-border bg-surface px-3 text-xs font-medium text-text-secondary hover:border-role-cast-light hover:text-role-cast hover:bg-role-cast-lighter transition-colors"
              >
                #{tag}
              </Button>
            ))}
        </div>
      </div>
    </div>
  );
};
