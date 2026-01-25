## 1. API Implementation
- [x] 1.1 Create `/api/cast/plans/route.ts` with GET handler
- [x] 1.2 Reuse gRPC client to fetch plans from backend

## 2. Page Implementation
- [x] 2.1 Remove `MOCK_PLANS` from `/cast/plans/page.tsx`
- [x] 2.2 Add `useEffect` to fetch plans on mount
- [x] 2.3 Add loading state handling
- [x] 2.4 Update save handler to call real API
- [x] 2.5 Add error handling and toast notifications
