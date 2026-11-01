import { displayStateOf } from "@/modules/post/lib/display-window";
import type { PostView } from "@/modules/post/lib/post-view";

export function isQuotable(post: Pick<PostView, "visibility" | "publishedAt" | "expiresAt">, now: Date = new Date()): boolean {
  return post.visibility === "public" && displayStateOf(post, now) === "live";
}
