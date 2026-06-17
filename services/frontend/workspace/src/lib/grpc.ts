import { createClient } from "@connectrpc/connect";
import { createGrpcTransport } from "@connectrpc/connect-node";
import { IdentityService } from "@/stub/identity/v1/service_pb";
import { OfferService } from "@/stub/offer/v1/service_pb";
import { CastService } from "@/stub/portfolio/v1/cast_service_pb";
import { GuestService } from "@/stub/portfolio/v1/guest_service_pb";
import { MediaService } from "@/stub/media/v1/media_service_pb";
import { PostService } from "@/stub/post/v1/post_service_pb";
import { LikeService } from "@/stub/post/v1/like_service_pb";
import { CommentService } from "@/stub/post/v1/comment_service_pb";
import { FollowService as SocialFollowService } from "@/stub/social/v1/follow_service_pb";
import { BlockService as SocialBlockService } from "@/stub/social/v1/block_service_pb";
import { FeedService } from "@/stub/feed/v1/feed_service_pb";
import { TrustService } from "@/stub/trust/v1/service_pb";
import { ProfileService } from "@/stub/profile/v1/service_pb";
import { NotificationService } from "@/stub/notifications/v1/notification_service_pb";
import { BookmarkService } from "@/stub/bookmarks/v1/bookmark_service_pb";
import { DiscoveryService } from "@/stub/discovery/v1/discovery_service_pb";
import { MessagingService } from "@/stub/messaging/v1/messaging_service_pb";
import { FootprintsService } from "@/stub/footprints/v1/footprints_service_pb";

// In server environment (Next.js API Routes), we connect to Monolith directly.
// Monolith is at 'http://monolith:9001' or 'http://localhost:9001' depending on Docker/Local.
// We should use ENV.
// standard gRPC server requires createGrpcTransport
const transport = createGrpcTransport({
  // FALLBACK: Uses localhost when MONOLITH_URL is not configured
  baseUrl: process.env.MONOLITH_URL || "http://localhost:9001",
});

export const identityClient = createClient(IdentityService, transport);
export const offerClient = createClient(OfferService, transport);
export const castClient = createClient(CastService, transport);
export const guestClient = createClient(GuestService, transport);

// Media domain client
export const mediaClient = createClient(MediaService, transport);

// Post domain clients
export const postClient = createClient(PostService, transport);
export const likeClient = createClient(LikeService, transport);
export const commentClient = createClient(CommentService, transport);

// Social domain clients (social.v1 — symmetric account-based follow/block)
export const socialFollowClient = createClient(SocialFollowService, transport);
export const socialBlockClient = createClient(SocialBlockService, transport);

// Feed domain client
export const feedClient = createClient(FeedService, transport);

// Trust domain client
export const trustClient = createClient(TrustService, transport);

// Profile domain client
export const profileClient = createClient(ProfileService, transport);

// Notifications domain client (notifications.v1)
export const notificationClient = createClient(NotificationService, transport);

// Bookmarks domain client (bookmarks.v1)
export const bookmarkClient = createClient(BookmarkService, transport);

// Discovery domain client (discovery.v1)
export const discoveryClient = createClient(DiscoveryService, transport);

// Messaging domain client (messaging.v1)
export const messagingClient = createClient(MessagingService, transport);

// Footprints domain client (footprints.v1)
export const footprintsClient = createClient(FootprintsService, transport);
