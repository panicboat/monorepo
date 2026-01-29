# Tasks: Connect Guest Search

## 1. Backend
- [ ] 1.1 Extend ListCasts RPC to support filtering (status, sortBy)
- [ ] 1.2 Add popular tags aggregation to ListCasts response
- [ ] 1.3 Update proto definitions if needed

## 2. Frontend API Route
- [ ] 2.1 Create `/api/guest/search/route.ts`
- [ ] 2.2 Implement query parameter handling (status, sort, tags)
- [ ] 2.3 Map gRPC response to frontend format

## 3. Frontend Page
- [ ] 3.1 Replace SEARCH_RESULTS mock with API fetch
- [ ] 3.2 Implement filter tabs (All/Online/New/Ranking)
- [ ] 3.3 Connect highlight section to filtered API data
- [ ] 3.4 Implement tag filtering

## 4. Testing
- [ ] 4.1 Test filter combinations
- [ ] 4.2 Test empty state handling
- [ ] 4.3 Test loading states
