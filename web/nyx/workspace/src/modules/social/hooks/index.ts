/**
 * Social Hooks
 *
 * Hooks for social features: timeline, likes, follows, comments.
 *
 * NOTE: Relationship hooks (useFollow, useBlock, useFavorite, useFollowRequests)
 * are now in @/modules/relationship. Re-exported here for backwards compatibility.
 */

export { useSocial } from "./useSocial";

// Re-export from relationship module for backwards compatibility
export {
  useFollow,
  useBlock,
  useFavorite,
  useFollowRequests,
} from "@/modules/relationship";

// Post-related hooks (will move to @/modules/post in future)
export { useGuestTimeline, useGuestPost } from "./useGuestTimeline";
export { useLike } from "./useLike";
export { useComments } from "./useComments";
export { useCastPosts } from "./useCastPosts";
