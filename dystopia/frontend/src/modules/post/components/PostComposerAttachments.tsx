import type { UploadedMedia } from "@/modules/media/types";

export interface PostComposerAttachmentsProps {
  items: UploadedMedia[];
  onRemove: (mediaId: string) => void;
  disabled?: boolean;
}

export function PostComposerAttachments({
  items,
  onRemove,
  disabled = false,
}: PostComposerAttachmentsProps) {
  if (items.length === 0) return null;

  return (
    <ul className="mt-3 flex flex-wrap gap-2" aria-label="添付したメディア">
      {items.map((item) => (
        <li key={item.mediaId} className="relative h-20 w-20 overflow-hidden rounded-md border border-border">
          {item.mediaType === "video" ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={item.localUrl} className="h-full w-full object-cover" muted />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.localUrl} alt={item.filename} className="h-full w-full object-cover" />
          )}
          <button
            type="button"
            onClick={() => onRemove(item.mediaId)}
            disabled={disabled}
            aria-label={`${item.filename}を削除`}
            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white"
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  );
}
