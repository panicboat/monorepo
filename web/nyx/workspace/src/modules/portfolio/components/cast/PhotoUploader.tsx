"use client";

import { useState, useRef, ChangeEvent } from "react";
import { Upload, X, Image as ImageIcon, Star } from "lucide-react";

interface PhotoUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  minImages?: number;
}

export const PhotoUploader = ({
  images,
  onChange,
  minImages = 3,
}: PhotoUploaderProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newImages = Array.from(e.target.files).map((file) =>
        URL.createObjectURL(file)
      );
      onChange([...images, ...newImages]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newImages = Array.from(e.dataTransfer.files)
        .filter((file) => file.type.startsWith("image/"))
        .map((file) => URL.createObjectURL(file));
      onChange([...images, ...newImages]);
    }
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onChange(newImages);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={triggerFileInput}
        className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 transition-all cursor-pointer ${isDragging
          ? "border-pink-500 bg-pink-50 scale-[1.02]"
          : "border-slate-200 bg-slate-50 hover:border-pink-300 hover:bg-pink-50/30"
          }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          multiple
          accept="image/*"
          onChange={handleFileSelect}
        />
        <div className="mb-4 rounded-full bg-white p-4 shadow-sm">
          <Upload className={`h-8 w-8 ${isDragging ? "text-pink-500" : "text-slate-400"}`} />
        </div>
        <p className="text-sm font-bold text-slate-700">
          Click or Drop Photos Here
        </p>
        <p className="mt-1 text-xs text-slate-400">
          JPG, PNG, WebP supported
        </p>
      </div>

      {/* Helper Text */}
      <div className="flex items-start gap-2 rounded-xl bg-blue-50 p-4 text-blue-700">
        <InfoIcon className="h-5 w-5 shrink-0" />
        <div className="text-xs leading-relaxed">
          <p className="font-bold mb-1">Upload Recommendation</p>
          <ul className="list-disc pl-4 space-y-1 opacity-80">
            <li>At least <strong>1</strong> photo is required ({minImages}+ recommended).</li>
            <li>The <strong>first photo</strong> will effectively be your <strong>Cover Image</strong>.</li>
            <li>Use high-quality photos to attract more guests.</li>
          </ul>
        </div>
      </div>

      {/* Image Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {images.map((src, index) => (
            <div
              key={index}
              className={`group relative aspect-[3/4] overflow-hidden rounded-xl bg-slate-100 ${index === 0 ? "ring-2 ring-pink-500 ring-offset-2" : ""
                }`}
            >
              {/* Cover Badge for First Item */}
              {index === 0 && (
                <div className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-full bg-pink-500 px-2 py-1 text-[10px] font-bold text-white shadow-md">
                  <Star size={10} fill="currentColor" />
                  <span>COVER</span>
                </div>
              )}

              {/* Number Badge */}
              <div className="absolute right-2 top-2 z-10 rounded-full bg-black/50 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
                #{index + 1}
              </div>

              <img
                src={src}
                alt={`Uploaded ${index + 1}`}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              />

              {/* Remove Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeImage(index);
                }}
                className="absolute right-2 bottom-2 rounded-full bg-white p-2 text-slate-900 shadow-md transition-transform hover:scale-110 hover:bg-red-50 hover:text-red-500 active:scale-95"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const InfoIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </svg>
);
