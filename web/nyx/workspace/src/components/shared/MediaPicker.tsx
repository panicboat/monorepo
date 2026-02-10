"use client";

import { useRef } from "react";
import { Image as ImageIcon, Video, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { motion, AnimatePresence } from "motion/react";

export type MediaFile = {
  file: File;
  previewUrl: string;
  type: "image" | "video";
};

export type UploadProgress = {
  current: number;
  total: number;
};

type MediaPickerProps = {
  files: MediaFile[];
  onChange: (files: MediaFile[]) => void;
  maxFiles: number;
  disabled?: boolean;
  progress?: UploadProgress | null;
  variant?: "default" | "compact";
  showLabels?: boolean;
};

export function MediaPicker({
  files,
  onChange,
  maxFiles,
  disabled = false,
  progress = null,
  variant = "default",
  showLabels = true,
}: MediaPickerProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "image" | "video"
  ) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const selected = Array.from(e.target.files);
    const remaining = maxFiles - files.length;

    const toAdd = selected.slice(0, remaining).map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      type,
    }));
    onChange([...files, ...toAdd]);
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    URL.revokeObjectURL(files[index].previewUrl);
    onChange(files.filter((_, i) => i !== index));
  };

  const isCompact = variant === "compact";
  const previewSize = isCompact ? "w-20 h-20" : "aspect-square";
  const gridCols = isCompact ? "" : "grid-cols-2";

  return (
    <div className="space-y-2">
      {/* Media previews */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className={isCompact ? "flex gap-2 flex-wrap" : `grid ${gridCols} gap-2`}>
              {files.map((mf, i) => (
                <div
                  key={i}
                  className={`relative rounded-xl overflow-hidden bg-black/5 ${previewSize}`}
                >
                  {mf.type === "video" ? (
                    <video
                      src={mf.previewUrl}
                      className="h-full w-full object-cover"
                      muted
                    />
                  ) : (
                    <img
                      src={mf.previewUrl}
                      alt={`Preview ${i + 1}`}
                      className="h-full w-full object-cover"
                    />
                  )}
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className={`absolute top-1 right-1 ${isCompact ? "h-5 w-5" : "h-6 w-6"} bg-surface/80 hover:bg-surface text-text-secondary`}
                    onClick={() => removeFile(i)}
                  >
                    <X size={isCompact ? 10 : 12} />
                  </Button>
                  {mf.type === "video" && (
                    <div className={`absolute bottom-1 left-1 bg-black/50 text-white font-bold px-1.5 py-0.5 rounded-full ${isCompact ? "text-[8px]" : "text-[9px]"}`}>
                      VIDEO
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-text-muted mt-1">
              {files.length}/{maxFiles} files
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload progress */}
      {progress && (
        <div className="space-y-1">
          <div className="h-1.5 bg-surface-secondary rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-role-cast rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(progress.current / progress.total) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <p className="text-[10px] text-text-muted">
            Uploading {progress.current}/{progress.total}...
          </p>
        </div>
      )}

      {/* File inputs (hidden) */}
      <input
        type="file"
        ref={imageInputRef}
        className="hidden"
        accept="image/*"
        multiple
        onChange={(e) => handleFileSelect(e, "image")}
      />
      <input
        type="file"
        ref={videoInputRef}
        className="hidden"
        accept="video/*"
        multiple
        onChange={(e) => handleFileSelect(e, "video")}
      />

      {/* Buttons */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`text-text-secondary hover:text-role-cast hover:bg-role-cast-lighter ${showLabels ? "gap-2" : "h-8 w-8 p-0"}`}
          onClick={() => imageInputRef.current?.click()}
          disabled={files.length >= maxFiles || disabled}
          aria-label="Add image"
        >
          <ImageIcon size={showLabels ? 18 : 16} />
          {showLabels && <span className="text-xs font-bold">Photo</span>}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`text-text-secondary hover:text-role-cast hover:bg-role-cast-lighter ${showLabels ? "gap-2" : "h-8 w-8 p-0"}`}
          onClick={() => videoInputRef.current?.click()}
          disabled={files.length >= maxFiles || disabled}
          aria-label="Add video"
        >
          <Video size={showLabels ? 18 : 16} />
          {showLabels && <span className="text-xs font-bold">Video</span>}
        </Button>
      </div>
    </div>
  );
}

// Separated components for flexible layouts

type MediaPreviewProps = {
  files: MediaFile[];
  onRemove: (index: number) => void;
  maxFiles: number;
  variant?: "default" | "compact";
};

export function MediaPreview({
  files,
  onRemove,
  maxFiles,
  variant = "default",
}: MediaPreviewProps) {
  const isCompact = variant === "compact";
  const previewSize = isCompact ? "w-20 h-20" : "aspect-square";
  const gridCols = isCompact ? "" : "grid-cols-2";

  if (files.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
    >
      <div className={isCompact ? "flex gap-2 flex-wrap" : `grid ${gridCols} gap-2`}>
        {files.map((mf, i) => (
          <div
            key={i}
            className={`relative rounded-xl overflow-hidden bg-black/5 ${previewSize}`}
          >
            {mf.type === "video" ? (
              <video
                src={mf.previewUrl}
                className="h-full w-full object-cover"
                muted
              />
            ) : (
              <img
                src={mf.previewUrl}
                alt={`Preview ${i + 1}`}
                className="h-full w-full object-cover"
              />
            )}
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className={`absolute top-1 right-1 ${isCompact ? "h-5 w-5" : "h-6 w-6"} bg-surface/80 hover:bg-surface text-text-secondary`}
              onClick={() => onRemove(i)}
            >
              <X size={isCompact ? 10 : 12} />
            </Button>
            {mf.type === "video" && (
              <div className={`absolute bottom-1 left-1 bg-black/50 text-white font-bold px-1.5 py-0.5 rounded-full ${isCompact ? "text-[8px]" : "text-[9px]"}`}>
                VIDEO
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="text-[10px] text-text-muted mt-1">
        {files.length}/{maxFiles} files
      </p>
    </motion.div>
  );
}

type MediaButtonsProps = {
  onImageClick: () => void;
  onVideoClick: () => void;
  disabled?: boolean;
  showLabels?: boolean;
};

export function MediaButtons({
  onImageClick,
  onVideoClick,
  disabled = false,
  showLabels = true,
}: MediaButtonsProps) {
  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={`text-text-secondary hover:text-role-cast hover:bg-role-cast-lighter ${showLabels ? "gap-2" : "h-8 w-8 p-0"}`}
        onClick={onImageClick}
        disabled={disabled}
        aria-label="Add image"
      >
        <ImageIcon size={showLabels ? 18 : 16} />
        {showLabels && <span className="text-xs font-bold">Photo</span>}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={`text-text-secondary hover:text-role-cast hover:bg-role-cast-lighter ${showLabels ? "gap-2" : "h-8 w-8 p-0"}`}
        onClick={onVideoClick}
        disabled={disabled}
        aria-label="Add video"
      >
        <Video size={showLabels ? 18 : 16} />
        {showLabels && <span className="text-xs font-bold">Video</span>}
      </Button>
    </div>
  );
}

type UploadProgressBarProps = {
  progress: UploadProgress;
};

export function UploadProgressBar({ progress }: UploadProgressBarProps) {
  return (
    <div className="space-y-1">
      <div className="h-1.5 bg-surface-secondary rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-role-cast rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${(progress.current / progress.total) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
      <p className="text-[10px] text-text-muted">
        Uploading {progress.current}/{progress.total}...
      </p>
    </div>
  );
}

// Hook for managing media files
export function useMediaFiles(maxFiles: number) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "image" | "video",
    currentFiles: MediaFile[],
    setFiles: (files: MediaFile[]) => void
  ) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const selected = Array.from(e.target.files);
    const remaining = maxFiles - currentFiles.length;

    const toAdd = selected.slice(0, remaining).map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      type,
    }));
    setFiles([...currentFiles, ...toAdd]);
    e.target.value = "";
  };

  const removeFile = (
    index: number,
    currentFiles: MediaFile[],
    setFiles: (files: MediaFile[]) => void
  ) => {
    URL.revokeObjectURL(currentFiles[index].previewUrl);
    setFiles(currentFiles.filter((_, i) => i !== index));
  };

  const clearFiles = (
    currentFiles: MediaFile[],
    setFiles: (files: MediaFile[]) => void
  ) => {
    currentFiles.forEach((mf) => URL.revokeObjectURL(mf.previewUrl));
    setFiles([]);
  };

  return {
    imageInputRef,
    videoInputRef,
    handleFileSelect,
    removeFile,
    clearFiles,
  };
}
