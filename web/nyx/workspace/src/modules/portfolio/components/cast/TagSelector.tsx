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
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold pointer-events-none">
            #
          </span>
          <Input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a tag..."
            className="pl-7 pr-4 font-bold focus-visible:ring-pink-500"
          />
        </div>
        <Button
          type="button"
          onClick={handleAdd}
          disabled={!input.trim()}
          size="icon"
          className="w-12 h-10 rounded-xl bg-slate-900 text-white disabled:bg-slate-200 disabled:text-slate-400"
        >
          <Plus size={20} />
        </Button>
      </div>

      {/* Selected Tags */}
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded-full bg-pink-100 px-3 py-1.5 text-xs font-bold text-pink-600"
          >
            #{tag}
            <button
              type="button"
              onClick={() => handleRemove(tag)}
              className="ml-1 rounded-full bg-white/50 p-0.5 hover:bg-white text-pink-500 transition-colors"
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>

      {/* Suggested */}
      <div className="pt-2">
        <p className="text-xs font-bold text-slate-400 mb-2 uppercase">
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
                className="h-7 rounded-full border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:border-pink-300 hover:text-pink-500 hover:bg-pink-50 transition-colors"
              >
                #{tag}
              </Button>
            ))}
        </div>
      </div>
    </div>
  );
};
