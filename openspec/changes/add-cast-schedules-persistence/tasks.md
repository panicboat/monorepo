## 1. URL Rename
- [ ] 1.1 Rename `/cast/schedule/` directory to `/cast/schedules/`
- [ ] 1.2 Update navigation links if any reference the old URL

## 2. API Implementation
- [ ] 2.1 Create `/api/cast/schedules/route.ts` with GET handler
- [ ] 2.2 Reuse gRPC client to fetch schedules from backend

## 3. Page Implementation
- [ ] 3.1 Remove mock data from `/cast/schedules/page.tsx`
- [ ] 3.2 Add `useEffect` to fetch schedules on mount
- [ ] 3.3 Add loading state handling
- [ ] 3.4 Update save handler to call real API
- [ ] 3.5 Add error handling and toast notifications
