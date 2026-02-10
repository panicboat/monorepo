# Tasks

## 1. Proto Definition

- [ ] 1.1 Add `ListFollowers` RPC to `proto/social/v1/follow_service.proto`
- [ ] 1.2 Add `FollowerItem` message type
- [ ] 1.3 Run `buf generate` to regenerate code

## 2. Backend Implementation

- [ ] 2.1 Add `list_followers` method to `FollowRepository` (exclude blocked users)
- [ ] 2.2 Add `list_followers` handler to `FollowHandler`
- [ ] 2.3 Update `BlockUser` use case to also remove follow relationship

## 3. API Routes

- [ ] 3.1 Create `app/api/cast/followers/route.ts` (GET)

## 4. Frontend Updates

- [ ] 4.1 Change delete button to block button in followers page
- [ ] 4.2 Call existing block API on button click
- [ ] 4.3 Remove mock handlers for `/api/cast/followers` from `mocks/handlers/cast.ts`

## 5. Validation

- [ ] 5.1 Verify TypeScript and ESLint pass
- [ ] 5.2 Test: block removes user from follower list
- [ ] 5.3 Test: blocked users don't appear in follower list

## Dependencies

```
Phase 1: Task 1 (Proto)
Phase 2: Task 2 (Backend) - after Phase 1
Phase 3: Task 3 (API Routes) - after Phase 2
Phase 4: Task 4, 5 (Frontend, Validation) - after Phase 3
```

## Notes

- All backend paths are relative to `services/monolith/workspace/`
- All frontend paths are relative to `web/nyx/workspace/src/`
