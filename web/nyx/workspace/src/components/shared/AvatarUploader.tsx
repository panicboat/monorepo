"use client";

import { useRef, ChangeEvent, useState } from "react";
import { Camera, X } from "lucide-react";

interface AvatarUploaderProps {
  mediaUrl?: string;
  onUpload: (file: File) => Promise<{ key: string; url: string }>;
  onClear?: () => void;
  accept?: string;
  size?: "sm" | "md" | "lg";
  label?: string;
  description?: string;
}

const sizeClasses = {
  sm: "h-16 w-16",
  md: "h-20 w-20",
  lg: "h-24 w-24",
};

const iconSizes = {
  sm: 20,
  md: 24,
  lg: 28,
};

export const AvatarUploader = ({
  mediaUrl,
  onUpload,
  onClear,
  accept = "image/*",
  size = "md",
  label,
  description,
}: AvatarUploaderProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(mediaUrl);

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];

      // Show preview immediately
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreviewUrl(event.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Upload file
      setIsUploading(true);
      try {
        const result = await onUpload(file);
        setPreviewUrl(result.url);
      } catch (error) {
        console.error("Upload failed:", error);
        setPreviewUrl(mediaUrl);
      } finally {
        setIsUploading(false);
      }
    }
    // Reset input value to allow re-selecting the same file
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewUrl(undefined);
    onClear?.();
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const displayUrl = previewUrl || mediaUrl;

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <button
          type="button"
          onClick={triggerFileInput}
          disabled={isUploading}
          className={`group relative ${sizeClasses[size]} shrink-0 overflow-hidden rounded-full border-2 border-dashed border-slate-200 bg-slate-50 transition-all hover:border-pink-300 hover:bg-pink-50/30 disabled:opacity-50`}
        >
          {displayUrl ? (
            <img
              src={displayUrl}
              alt="Avatar"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Camera
                size={iconSizes[size]}
                className="text-slate-400 group-hover:text-pink-500 transition-colors"
              />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100 rounded-full">
            {isUploading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Camera size={iconSizes[size] - 4} className="text-white" />
            )}
          </div>
        </button>
        {displayUrl && onClear && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-md hover:bg-red-50 hover:text-red-500 transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={accept}
        onChange={handleFileSelect}
      />
      {(label || description) && (
        <div className="text-xs text-slate-500 leading-relaxed">
          {label && <p className="font-medium text-slate-700">{label}</p>}
          {description && <p>{description}</p>}
        </div>
      )}
    </div>
  );
};
