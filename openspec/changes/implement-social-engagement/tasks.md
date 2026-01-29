# Tasks: Implement Social Engagement

## 1. Database Schema
- [ ] 1.1 Create social__follows table (follower_id, following_id, created_at)
- [ ] 1.2 Create social__favorites table (user_id, cast_id, created_at)
- [ ] 1.3 Create social__blocks table (blocker_id, blocked_id, created_at)
- [ ] 1.4 Create social__footprints table (visitor_id, visited_id, visited_at)

## 2. Backend - Social Domain
- [ ] 2.1 Create follows relation and repository
- [ ] 2.2 Create favorites relation and repository
- [ ] 2.3 Create blocks relation and repository
- [ ] 2.4 Create footprints relation and repository

## 3. Proto & gRPC
- [ ] 3.1 Define SocialService proto (Follow, Unfollow, ListFollowing, ListFollowers)
- [ ] 3.2 Define Favorite RPCs (AddFavorite, RemoveFavorite, ListFavorites)
- [ ] 3.3 Define Block RPCs (Block, Unblock, ListBlocked)
- [ ] 3.4 Define Footprint RPCs (RecordFootprint, ListFootprints)
- [ ] 3.5 Implement gRPC handler

## 4. Frontend API Routes
- [ ] 4.1 Create /api/social/follow route
- [ ] 4.2 Create /api/social/favorite route
- [ ] 4.3 Create /api/social/block route
- [ ] 4.4 Create /api/guest/footprints route
- [ ] 4.5 Update /api/cast/mypage to return real followers count

## 5. Frontend Pages
- [ ] 5.1 Connect /guest/following to real API
- [ ] 5.2 Connect /guest/favorites to real API
- [ ] 5.3 Connect /guest/blocking to real API
- [ ] 5.4 Connect /guest/footprints to real API
- [ ] 5.5 Add follow/favorite/block buttons to cast detail page

## 6. Cast Side
- [ ] 6.1 Implement /cast/followers page (if needed)
- [ ] 6.2 Update mypage stats to show real followers count

## 7. Testing
- [ ] 7.1 Test follow/unfollow flow
- [ ] 7.2 Test favorite/unfavorite flow
- [ ] 7.3 Test block/unblock flow
- [ ] 7.4 Test footprint recording on profile view
