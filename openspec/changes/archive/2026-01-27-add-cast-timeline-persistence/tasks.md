## 1. Database Schema
- [ ] 1.1 Create `cast_posts` table migration
- [ ] 1.2 Create `cast_post_media` table migration (for images/videos)

## 2. Proto Definition (social/v1)
- [ ] 2.1 Create `proto/social/v1/service.proto`
- [ ] 2.2 Add `CastPost`, `CastPostMedia`, `CastPostAuthor` messages
- [ ] 2.3 Add `ListCastPosts`, `SaveCastPost`, `DeleteCastPost` RPCs
- [ ] 2.4 Generate proto code

## 3. Backend Implementation (slices/social)
- [ ] 3.1 Create `slices/social/` directory structure
- [ ] 3.2 Create `relations/cast_posts.rb`
- [ ] 3.3 Create `relations/cast_post_media.rb`
- [ ] 3.4 Create `repositories/post_repository.rb`
- [ ] 3.5 Create `contracts/save_post_contract.rb`
- [ ] 3.6 Create `use_cases/posts/list_posts.rb` with cursor-based pagination
- [ ] 3.7 Create `use_cases/posts/save_post.rb` (create + update)
- [ ] 3.8 Create `use_cases/posts/delete_post.rb`
- [ ] 3.9 Create `presenters/post_presenter.rb`
- [ ] 3.10 Create `grpc/handler.rb`

## 4. Frontend API
- [ ] 4.1 Create `/api/cast/timeline/route.ts` with GET handler
- [ ] 4.2 Add PUT handler for saving posts (create + update)
- [ ] 4.3 Add DELETE handler for deleting posts

## 5. Frontend Module (modules/social)
- [ ] 5.1 Create `modules/social/types.ts`
- [ ] 5.2 Create `modules/social/hooks/useCastPosts.ts`
- [ ] 5.3 Create `modules/social/lib/` mappers

## 6. Frontend Page
- [ ] 6.1 Remove mock data from `/cast/timeline/page.tsx`
- [ ] 6.2 Integrate `useCastPosts` hook
- [ ] 6.3 Integrate API for listing posts
- [ ] 6.4 Integrate API for saving posts (create + edit)
- [ ] 6.5 Integrate API for deleting posts
- [ ] 6.6 Add loading and error states
- [ ] 6.7 Implement infinite scroll with cursor-based pagination
