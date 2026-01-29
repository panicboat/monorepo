# Tasks

## Backend

- [ ] Create migration for `social__cast_post_hashtags` table (post_id, tag)
- [ ] Add `CastPostHashtags` relation in Social slice
- [ ] Update `CastPostsRepository` to handle hashtags (save, load)
- [ ] Update `SavePost` use case to accept and persist hashtags
- [ ] Update `ListPosts` use case to include hashtags in response
- [ ] Update `PostPresenter` to include hashtags in proto response
- [ ] Add `hashtags` field to `CastPost` proto message
- [ ] Regenerate Ruby proto stubs

## Frontend

- [ ] Add `hashtags` field to `CastPost` type
- [ ] Regenerate TypeScript proto stubs
- [ ] Update `mapApiToPost` to include hashtags
- [ ] Create `HashtagInput` component (free text input with tag chips)
- [ ] Add hashtag input to timeline post form
- [ ] Display hashtags on post cards
- [ ] Update `savePost` to include hashtags in payload

## Future (out of scope for this change)

- [ ] Hashtag search/filter API
- [ ] Clickable hashtag links
- [ ] Trending hashtags
