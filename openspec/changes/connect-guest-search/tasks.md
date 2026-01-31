# Tasks: Connect Guest Search

## 1. Genre Master (Backend)
- [x] 1.1 Create genres table (id, name, slug, display_order, is_active)
- [x] 1.2 Add Genre proto message to portfolio/v1
- [x] 1.3 Implement ListGenres RPC
- [x] 1.4 Seed initial genres (風俗, P活, レンタル彼女, etc.)

## 2. Cast-Genre Association (Backend)
- [x] 2.1 Create cast_genres join table
- [x] 2.2 Update CreateCast/UpdateCast to accept genre_ids
- [x] 2.3 Add genres to GetCast/ListCasts response
- [x] 2.4 Validate at least one genre on cast creation (frontend validation)

## 3. Tag System (Backend)
- [x] 3.1 Tags stored in cast profile JSONB field (existing)
- [x] 3.2 No separate table needed (uses existing tags field)
- [x] 3.3 Implement popular tags aggregation (ListPopularTags RPC)
- [x] 3.4 Add tags to cast profile (already exists)

## 4. Search API (Backend)
- [x] 4.1 Extend ListCasts to support genre_id filter
- [x] 4.2 Extend ListCasts to support tag filter
- [x] 4.3 Extend ListCasts to support status filter (online, new, ranking)
- [x] 4.4 Add combined filter logic (AND conditions)

## 5. Frontend API Routes
- [x] 5.1 Create `/api/guest/genres/route.ts` (ListGenres)
- [x] 5.2 Create `/api/guest/search/route.ts` (ListCasts with filters)
- [x] 5.3 Create `/api/guest/tags/popular/route.ts` (popular tags)

## 6. Cast Profile (Frontend)
- [x] 6.1 Add genre selector to onboarding step
- [x] 6.2 Add genre selector to profile edit (via StyleInputs component)
- [x] 6.3 Tag input already exists in profile edit

## 7. Guest Search Page (Frontend)
- [x] 7.1 Add genre filter tabs/pills
- [x] 7.2 Replace mock data with API fetch
- [x] 7.3 Implement status filter tabs (All/Online/New/Ranking)
- [x] 7.4 Implement tag filter from popular tags
- [x] 7.5 Connect highlight section to filtered API data
- [x] 7.6 Display genre badge on cast cards

## 8. Online Status Feature (追加実装)
- [x] 8.1 Add `is_online` field to CastProfile proto
- [x] 8.2 Add `is_online?` and `online_cast_ids` methods to cast_repository
- [x] 8.3 Update ProfilePresenter to accept `is_online` parameter
- [x] 8.4 Calculate and pass `is_online` in ListCasts handler
- [x] 8.5 Add `isOnline` to frontend profile mapping
- [x] 8.6 Display ONLINE badge on cast cards (both highlight and grid)

## 9. Testing
- [x] 9.1 Backend: Filter combinations test (list_casts_spec.rb)
- [x] 9.2 Backend: is_online? and online_cast_ids tests (cast_repository_spec.rb)
- [x] 9.3 Backend: get_popular_tags tests (cast_repository_spec.rb)
- [x] 9.4 Backend: Text search query tests (cast_repository_spec.rb)
- [ ] 9.5 Frontend: Component tests (test infrastructure not set up)

## 10. Full-Screen Filter Page (UX改善)
- [x] 10.1 Add `query` field to ListCastsRequest proto
- [x] 10.2 Implement text search logic in cast_repository (ILIKE for name, tagline)
- [x] 10.3 Update use case and handler for query parameter
- [x] 10.4 Create SearchFilterOverlay component with motion animations
- [x] 10.5 Integrate overlay into search page (filter icon opens overlay)
- [x] 10.6 Connect text search to API
- [x] 10.7 Display active filter badges on search bar
- [x] 10.8 Add filter count badge to filter icon

---

## Implementation Notes

### Database Migrations Created
- `20260131001000_create_genres.rb` - genres table with initial seed data
- `20260131002000_create_cast_genres.rb` - cast_genres join table

### Proto Changes
- Added `Genre` message
- Added `CastStatusFilter` enum
- Extended `ListCastsRequest` with filters (genre_id, tag, status_filter, area_id, limit, offset, query)
- Added `ListGenresRequest/Response`
- Added `ListPopularTagsRequest/Response` with `PopularTag` message
- Extended `CastProfile` with `genres` field
- Added `is_online` field to `CastProfile` (動的計算)
- Added `query` field to `ListCastsRequest` for text search

### Backend Files Modified/Created
- `slices/portfolio/relations/genres.rb`
- `slices/portfolio/relations/cast_genres.rb`
- `slices/portfolio/repositories/genre_repository.rb`
- `slices/portfolio/repositories/cast_repository.rb` (extended with genre methods)
- `slices/portfolio/use_cases/cast/listing/list_casts.rb` (extended with filters)
- `slices/portfolio/use_cases/cast/profile/save_profile.rb` (genre_ids support)
- `slices/portfolio/presenters/cast/profile_presenter.rb` (genre support)
- `slices/portfolio/grpc/handler.rb` (ListGenres, ListPopularTags, extended ListCasts)

### Frontend Files Modified/Created
- `src/app/api/guest/genres/route.ts`
- `src/app/api/guest/search/route.ts` (query parameter added)
- `src/app/api/guest/tags/popular/route.ts`
- `src/app/(guest)/search/page.tsx` (full-screen filter integration)
- `src/app/(guest)/search/SearchFilterOverlay.tsx` (new component)
- `src/modules/portfolio/types.ts` (Genre type, genreIds in ProfileFormData)
- `src/modules/portfolio/hooks/useGenres.ts`
- `src/modules/portfolio/components/cast/GenreSelector.tsx`
- `src/modules/portfolio/components/cast/StyleInputs.tsx` (genre selector added)
- `src/modules/portfolio/lib/cast/mappers.ts` (genreIds mapping)
- `src/modules/portfolio/lib/cast/profile.ts` (genres in response)
- `src/modules/portfolio/hooks/useCastData.ts` (genreIds support)
