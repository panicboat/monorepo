import { createClient } from "@connectrpc/connect";
import { createGrpcTransport } from "@connectrpc/connect-node";
import { traceContextInterceptor } from "@/lib/otel-interceptor";
import { IdentityService } from "@/stub/identity/v1/service_pb";
import { MediaService } from "@/stub/media/v1/media_service_pb";
import { PostService } from "@/stub/post/v1/post_service_pb";
import { LikeService } from "@/stub/post/v1/like_service_pb";
import { CommentService } from "@/stub/post/v1/comment_service_pb";
import { FollowService as SocialFollowService } from "@/stub/social/v1/follow_service_pb";
import { BlockService as SocialBlockService } from "@/stub/social/v1/block_service_pb";
import { FeedService } from "@/stub/feed/v1/feed_service_pb";
import { ProfileService } from "@/stub/profile/v1/service_pb";
import { NotificationService } from "@/stub/notifications/v1/notification_service_pb";
import { BookmarkService } from "@/stub/bookmarks/v1/bookmark_service_pb";
import { KarteService } from "@/stub/karte/v1/service_pb";
import { ReviewService } from "@/stub/review/v1/service_pb";
import { DiscoveryService } from "@/stub/discovery/v1/discovery_service_pb";
import { MessagingService } from "@/stub/messaging/v1/messaging_service_pb";
import { FootprintsService } from "@/stub/footprints/v1/footprints_service_pb";
import { ScheduleService } from "@/stub/schedule/v1/schedule_service_pb";

const baseUrl = process.env.MONOLITH_URL || "http://localhost:9001";
const transport = createGrpcTransport({
  baseUrl,
  interceptors: [traceContextInterceptor],
});
// Keep streaming RPCs on a separate transport because long-lived streams can block unary RPCs.
const streamingTransport = createGrpcTransport({
  baseUrl,
  interceptors: [traceContextInterceptor],
});

export const identityClient = createClient(IdentityService, transport);

export const mediaClient = createClient(MediaService, transport);

export const postClient = createClient(PostService, transport);
export const likeClient = createClient(LikeService, transport);
export const commentClient = createClient(CommentService, transport);

export const socialFollowClient = createClient(SocialFollowService, transport);
export const socialBlockClient = createClient(SocialBlockService, transport);

export const feedClient = createClient(FeedService, transport);

export const profileClient = createClient(ProfileService, transport);

export const notificationClient = createClient(NotificationService, transport);

export const bookmarkClient = createClient(BookmarkService, transport);

export const discoveryClient = createClient(DiscoveryService, transport);

export const messagingClient = createClient(MessagingService, transport);
export const messagingStreamingClient = createClient(MessagingService, streamingTransport);

export const footprintsClient = createClient(FootprintsService, transport);

export const karteClient = createClient(KarteService, transport);

export const reviewClient = createClient(ReviewService, transport);

export const scheduleClient = createClient(ScheduleService, transport);
