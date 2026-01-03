"use client";

import React from "react";
import { X, Plus, ImagePlus } from "lucide-react";

interface PhotoUploaderProps {
  photos: string[];
  onChange: (photos: string[]) => void;
  maxPhotos?: number;
}

export default function PhotoUploader({ photos, onChange, maxPhotos = 4 }: PhotoUploaderProps) {
  const handleRemove = (index: number) => {
    const newPhotos = [...photos];
    newPhotos.splice(index, 1);
    onChange(newPhotos);
  };

  const handleAdd = () => {
    // In a real app, this would trigger a file picker or media library.
    // For this prototype, we'll just add a placeholder image.
    const mockImage = `https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80&t=${Date.now()}`;
    onChange([...photos, mockImage]);
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
      {photos.map((photo, index) => (
        <div key={index} className="relative shrink-0 w-24 h-32 rounded-xl overflow-hidden border border-slate-700 group">
          <img src={photo} alt={`Profile ${index + 1}`} className="w-full h-full object-cover" />
          <button
            onClick={() => handleRemove(index)}
            className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition hover:bg-red-500"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}

      {photos.length < maxPhotos && (
        <button
          onClick={handleAdd}
          className="shrink-0 w-24 h-32 rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/50 flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-white hover:border-slate-500 transition"
        >
          <ImagePlus className="w-6 h-6" />
          <span className="text-[10px] font-bold">追加</span>
        </button>
      )}
    </div>
  );
}
