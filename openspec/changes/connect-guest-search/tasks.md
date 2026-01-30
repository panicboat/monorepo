# Tasks: Connect Guest Search

## 1. Genre Master (Backend)
- [ ] 1.1 Create genres table (id, name, slug, display_order, is_active)
- [ ] 1.2 Add Genre proto message to portfolio/v1
- [ ] 1.3 Implement ListGenres RPC
- [ ] 1.4 Seed initial genres (風俗, P活, レンタル彼女, etc.)

## 2. Cast-Genre Association (Backend)
- [ ] 2.1 Create cast_genres join table
- [ ] 2.2 Update CreateCast/UpdateCast to accept genre_ids
- [ ] 2.3 Add genres to GetCast/ListCasts response
- [ ] 2.4 Validate at least one genre on cast creation

## 3. Tag System (Backend)
- [ ] 3.1 Create tags table (id, name, usage_count)
- [ ] 3.2 Create cast_tags join table
- [ ] 3.3 Implement popular tags aggregation
- [ ] 3.4 Add tags to cast profile

## 4. Search API (Backend)
- [ ] 4.1 Extend ListCasts to support genre_id filter
- [ ] 4.2 Extend ListCasts to support tag filter
- [ ] 4.3 Extend ListCasts to support status filter (online, new, ranking)
- [ ] 4.4 Add combined filter logic (AND conditions)

## 5. Frontend API Routes
- [ ] 5.1 Create `/api/guest/genres/route.ts` (ListGenres)
- [ ] 5.2 Create `/api/guest/search/route.ts` (ListCasts with filters)
- [ ] 5.3 Create `/api/guest/tags/popular/route.ts` (popular tags)

## 6. Cast Profile (Frontend)
- [ ] 6.1 Add genre selector to onboarding step
- [ ] 6.2 Add genre selector to profile edit
- [ ] 6.3 Add tag input to profile edit

## 7. Guest Search Page (Frontend)
- [ ] 7.1 Add genre filter tabs/pills
- [ ] 7.2 Replace mock data with API fetch
- [ ] 7.3 Implement status filter tabs (All/Online/New/Ranking)
- [ ] 7.4 Implement tag filter from popular tags
- [ ] 7.5 Connect highlight section to filtered API data
- [ ] 7.6 Display genre badge on cast cards

## 8. Testing
- [ ] 8.1 Test filter combinations (genre + status + tag)
- [ ] 8.2 Test empty state handling
- [ ] 8.3 Test loading states
