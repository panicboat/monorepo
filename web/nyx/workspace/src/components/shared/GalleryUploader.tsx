"use client";

import { useState, useRef, ChangeEvent } from "react";
import { Upload, X, Star, PlayCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface MediaItem {
  url: string;
  key?: string;
  type: "image" | "video";
}

interface GalleryUploaderProps {
  images: MediaItem[];
  onChange: (images: MediaItem[]) => void;
  onUpload: (file: File) => Promise<MediaItem | null>;
  minImages?: number;
}

export const GalleryUploader = ({
  images,
  onChange,
  onUpload,
  minImages = 3,
}: GalleryUploaderProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File): Promise<MediaItem | null> => {
    return onUpload(file);
  };

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const results = await Promise.all(files.map(uploadFileWithRetry));
      const validResults = results.filter((r): r is MediaItem => r !== null);
      if (validResults.length > 0) {
        onChange([...images, ...validResults]);
      }
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files).filter(
        (file) =>
          file.type.startsWith("image/") || file.type.startsWith("video/")
      );
      const results = await Promise.all(files.map(uploadFileWithRetry));
      const validResults = results.filter((r): r is MediaItem => r !== null);
      if (validResults.length > 0) {
        onChange([...images, ...validResults]);
      }
    }
  };

  const uploadFileWithRetry = async (file: File) => {
    return handleUpload(file);
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
        className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 transition-all cursor-pointer ${
          isDragging
            ? "border-pink-500 bg-pink-50 scale-[1.02]"
            : "border-slate-200 bg-slate-50 hover:border-pink-300 hover:bg-pink-50/30"
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          multiple
          accept="image/*,video/*"
          onChange={handleFileSelect}
        />
        <div className="mb-4 rounded-full bg-white p-4 shadow-sm">
          <Upload
            className={`h-8 w-8 ${
              isDragging ? "text-pink-500" : "text-slate-400"
            }`}
          />
        </div>
        <p className="text-sm font-bold text-slate-700">
          Click or Drop Media Here
        </p>
        <p className="mt-1 text-xs text-slate-400">
          JPG, PNG, WebP, MP4 supported
        </p>
      </div>

      {/* Helper Text */}
      <div className="flex items-start gap-2 rounded-xl bg-blue-50 p-4 text-blue-700">
        <Info className="h-5 w-5 shrink-0" />
        <div className="text-xs leading-relaxed">
          <p className="font-bold mb-1">Upload Recommendation</p>
          <ul className="list-disc pl-4 space-y-1 opacity-80">
            <li>
              At least <strong>1</strong> media item is required ({minImages}+
              recommended).
            </li>
            <li>
              The <strong>first item</strong> will effectively be your{" "}
              <strong>Cover Media</strong>.
            </li>
            <li>Use high-quality photos/videos to attract more guests.</li>
          </ul>
        </div>
      </div>

      {/* Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {images.map((item, index) => (
            <div
              key={index}
              onClick={() => {
                if (index === 0) return;
                const newImages = [...images];
                const [movedImage] = newImages.splice(index, 1);
                newImages.unshift(movedImage);
                onChange(newImages);
              }}
              className={`group relative aspect-[3/4] overflow-hidden rounded-xl bg-slate-100 transition-all ${
                index === 0
                  ? "ring-2 ring-pink-500 ring-offset-2"
                  : "cursor-pointer hover:ring-2 hover:ring-pink-300 hover:ring-offset-1"
              }`}
            >
              {/* Cover Badge for First Item */}
              {index === 0 && (
                <div className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-full bg-pink-500 px-3 py-1 text-[10px] font-bold text-white shadow-md">
                  <Star size={10} fill="currentColor" />
                  <span>COVER</span>
                </div>
              )}

              {/* Set Cover Overlay Hint */}
              {index !== 0 && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-slate-700 shadow-sm">
                    Set as Cover
                  </span>
                </div>
              )}

              {/* Number Badge */}
              <div className="absolute right-2 top-2 z-10 rounded-full bg-black/50 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
                #{index + 1}
              </div>

              {/* Media Content */}
              {item.type === "video" ? (
                <>
                  <video
                    src={item.url}
                    className="h-full w-full object-cover"
                    muted
                    autoPlay
                    loop
                    playsInline
                  />
                  <div className="absolute bottom-2 right-2 z-10 text-white/80">
                    <PlayCircle size={20} fill="rgba(0,0,0,0.5)" />
                  </div>
                </>
              ) : (
                <img
                  src={item.url}
                  alt={`Uploaded ${index + 1}`}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
              )}

              {/* Remove Button */}
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  removeImage(index);
                }}
                className="absolute right-2 bottom-2 z-30 h-8 w-8 rounded-full bg-white text-slate-900 shadow-md transition-transform hover:scale-110 hover:bg-red-50 hover:text-red-500 active:scale-95"
              >
                <X size={16} />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
