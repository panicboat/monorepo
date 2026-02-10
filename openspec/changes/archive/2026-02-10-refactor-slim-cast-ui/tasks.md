# Tasks

## 1. Delete Cast Pages (Ritual/Trust Domains)

- [x] 1.1 Delete `app/(cast)/cast/reviews/` directory (Trust)
- [x] 1.2 Delete `app/(cast)/cast/history/page.tsx` (Ritual)
- [x] 1.3 Delete `app/(cast)/cast/pledges/` directory (Ritual)
- [x] 1.4 Delete `app/(cast)/cast/schedules/page.tsx` (Ritual)
- [x] 1.5 Delete `app/(cast)/cast/onboarding/step-4/` directory (uses WeeklyScheduleInput)

## 2. Delete Modules

- [x] 2.1 Delete `modules/ritual/` directory
- [x] 2.2 Delete `modules/trust/` directory

## 3. Delete Home Components

- [x] 3.1 Delete `app/(cast)/cast/home/components/EarningsSummary.tsx`
- [x] 3.2 Delete `app/(cast)/cast/home/components/UpcomingReservations.tsx`

## 4. Delete API Routes

- [x] 4.1 Delete `app/api/ritual/` directory
- [x] 4.2 Delete `app/api/trust/` directory

## 5. Delete Specs

- [x] 5.1 Delete `openspec/specs/concierge/` directory
- [x] 5.2 Delete `openspec/specs/ritual/` directory
- [x] 5.3 Delete `openspec/specs/trust/` directory
- [x] 5.4 Delete `openspec/specs/history-reviews/` directory
- [x] 5.5 Delete `openspec/specs/schedule/` directory

## 6. Modify Cast Home Page

- [x] 6.1 Remove EarningsSummary import and usage from `home/page.tsx`
- [x] 6.2 Remove UpcomingReservations import and usage from `home/page.tsx`
- [x] 6.3 Remove API calls to `/api/cast/stats` and `/api/cast/upcoming-reservations`
- [x] 6.4 Add FollowRequestList component (reuse existing `/cast/followers/requests` logic)
- [x] 6.5 Add NewFollowersList component

## 7. Modify Cast MyPage

- [x] 7.1 Remove "レビュー管理" menu item (link to `/cast/reviews`)
- [x] 7.2 Remove "履歴・売上" menu item (link to `/cast/history`)
- [x] 7.3 Add "フォロワーリスト" menu item (link to `/cast/followers`)
- [x] 7.4 Update Stats Display to show only Followers count

## 8. Modify Navigation

- [x] 8.1 Update CastTopNavBar: remove title cases for `/cast/reviews`, `/cast/history`, `/cast/schedules`
- [x] 8.2 Update CastBottomNavBar: remove "Schedule" tab
- [x] 8.3 Update onboarding flow: remove step-4 from navigation (3 steps only)

## 9. Modify Profile Edit Page

- [x] 9.1 Change SectionCard default state from collapsed to expanded
- [x] 9.2 Verify all sections are expanded on initial load

## 10. Create Follower List Page

- [x] 10.1 Create `app/(cast)/cast/followers/page.tsx`
- [x] 10.2 Implement follower list with UserListCard component
- [x] 10.3 Add remove follower functionality with confirmation dialog
- [x] 10.4 Add empty state for no followers
- [x] 10.5 Implement pagination or infinite scroll

## 11. Update Mock Handlers

- [x] 11.1 Remove mock handlers for `/api/cast/stats` from `mocks/handlers/cast.ts`
- [x] 11.2 Remove mock handlers for `/api/cast/upcoming-reservations`
- [x] 11.3 Remove mock handlers for `/api/cast/reservations/:id`
- [x] 11.4 Remove mock handlers for `/api/cast/guests/:id`

## 12. Update OpenSpec Project Definition

- [x] 12.1 Update `openspec/project.md` to reflect 3 domain architecture
- [x] 12.2 Fix legacy `/manage/...` URLs in remaining specs

## 13. Cleanup & Validation

- [x] 13.1 Remove orphaned imports and references
- [x] 13.2 Run TypeScript check (`pnpm tsc --noEmit`)
- [x] 13.3 Run ESLint check
- [x] 13.4 Run `openspec validate --strict`
- [ ] 13.5 Manual test: verify removed pages return 404
- [ ] 13.6 Manual test: verify navigation works correctly

## Dependencies

```
Phase 1 (Parallel):
├── Task 1 (Delete pages)
├── Task 2 (Delete modules)
├── Task 3 (Delete components)
├── Task 4 (Delete API routes)
└── Task 5 (Delete specs)

Phase 2 (After Phase 1):
├── Task 6 (Modify home)
├── Task 7 (Modify mypage)
├── Task 8 (Modify navigation)
├── Task 9 (Modify profile)
└── Task 10 (Create follower list)

Phase 3 (After Phase 2):
├── Task 11 (Update mocks)
└── Task 12 (Update project docs)

Phase 4 (Final):
└── Task 13 (Cleanup & validation)
```

## Notes

- All paths are relative to `web/nyx/workspace/src/`
- Onboarding reduces from 4 steps to 3 steps (remove WeeklyScheduleInput)
- Bottom nav reduces from 4 tabs to 3 tabs (Home, Timeline, MyPage)
- Backend API and database are NOT affected (UI-only changes)
