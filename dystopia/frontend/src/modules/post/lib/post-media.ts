import type { UploadedMedia } from "@/modules/media/types";
import type { SavePostMediaInput } from "@/modules/post/lib/post-view";

export function toSavePostMedia(items: UploadedMedia[]): SavePostMediaInput[] {
  return items.map((item) => ({
    mediaType: item.mediaType,
    mediaId: item.mediaId,
  }));
}
