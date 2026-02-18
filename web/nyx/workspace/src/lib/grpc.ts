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
import { FollowService } from "@/stub/relationship/v1/follow_service_pb";
import { BlockService } from "@/stub/relationship/v1/block_service_pb";
import { FavoriteService } from "@/stub/relationship/v1/favorite_service_pb";
import { FeedService } from "@/stub/feed/v1/feed_service_pb";
import { TrustService } from "@/stub/trust/v1/service_pb";

// In server environment (Next.js API Routes), we connect to Monolith directly.
// Monolith is at 'http://monolith:9001' or 'http://localhost:9001' depending on Docker/Local.
// We should use ENV.
// standard gRPC server requires createGrpcTransport
const transport = createGrpcTransport({
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

// Relationship domain clients
export const followClient = createClient(FollowService, transport);
export const blockClient = createClient(BlockService, transport);
export const favoriteClient = createClient(FavoriteService, transport);

// Feed domain client
export const feedClient = createClient(FeedService, transport);

// Trust domain client
export const trustClient = createClient(TrustService, transport);
