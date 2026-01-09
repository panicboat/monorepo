import { X, Plus } from "lucide-react";
import { useState } from "react";

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

  const suggestedTags = ["EnglishOK", "Singer", "AnimeLover", "Cosplay", "Student", "Model", "Golfer"];

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">#</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a tag..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-7 pr-4 py-3 font-bold text-slate-900 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
          />
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!input.trim()}
          className="flex items-center justify-center w-12 rounded-xl bg-slate-900 text-white disabled:bg-slate-200 disabled:text-slate-400"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Selected Tags */}
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded-full bg-pink-100 px-3 py-1.5 text-xs font-bold text-pink-600"
          >
            #{tag}
            <button onClick={() => handleRemove(tag)} className="ml-1 rounded-full bg-white/50 p-0.5 hover:bg-white text-pink-500">
              <X size={12} />
            </button>
          </span>
        ))}
      </div>

      {/* Suggested */}
      <div className="pt-2">
        <p className="text-xs font-bold text-slate-400 mb-2 uppercase">Suggestions</p>
        <div className="flex flex-wrap gap-2">
          {suggestedTags.filter(t => !tags.includes(t)).map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => onChange([...tags, tag])}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:border-pink-300 hover:text-pink-500 hover:bg-pink-50 transition-colors"
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
