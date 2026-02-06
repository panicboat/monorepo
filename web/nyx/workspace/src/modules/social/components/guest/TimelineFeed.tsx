/**
 * Re-export from feed module for backwards compatibility.
 * New imports should use: @/modules/social/components/feed
 */
export {
  TimelineFeed,
  TimelineItem,
  type FeedItem,
  type FeedMediaItem,
  mapPostToFeedItem,
} from "../feed";
