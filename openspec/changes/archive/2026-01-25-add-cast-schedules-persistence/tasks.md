## 0. Backend Fix
- [x] 0.1 Modify `save_schedules` to preserve past schedules (only delete/replace today and future)
- [x] 0.2 Add test to verify past schedules are preserved

## 1. URL Rename
- [x] 1.1 Rename `/cast/schedule/` directory to `/cast/schedules/`
- [x] 1.2 Update navigation links if any reference the old URL

## 2. API Implementation
- [x] 2.1 Create `/api/cast/schedules/route.ts` with GET handler
- [x] 2.2 Reuse gRPC client to fetch schedules from backend

## 3. Page Implementation
- [x] 3.1 Remove mock data from `/cast/schedules/page.tsx`
- [x] 3.2 Add `useEffect` to fetch schedules on mount
- [x] 3.3 Add loading state handling
- [x] 3.4 Update save handler to call real API
- [x] 3.5 Add error handling and toast notifications
