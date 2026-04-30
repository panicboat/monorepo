"use client";

import { MultiSelect } from "@/components/ui/MultiSelect";
import { useGenres } from "@/modules/portfolio/hooks/useGenres";

interface GenreSelectorProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  maxSelections?: number;
}

export const GenreSelector = ({
  selectedIds,
  onChange,
  maxSelections = 3,
}: GenreSelectorProps) => {
  const { genres, loading } = useGenres();

  return (
    <MultiSelect
      items={genres}
      selectedIds={selectedIds}
      onChange={onChange}
      maxSelections={maxSelections}
      loading={loading}
      helpText="最低1つ、最大{max}ジャンルまで選択できます（{count}/{max}）"
      variant="cast"
    />
  );
};
