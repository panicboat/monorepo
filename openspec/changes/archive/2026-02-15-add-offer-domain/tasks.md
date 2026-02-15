# Tasks

## 1. Backend Infrastructure

- [x] 1.1 Create `slices/offer/` directory structure
- [x] 1.2 Create base repository and relation classes
- [x] 1.3 Create gRPC handler skeleton

## 2. Proto Definition

- [x] 2.1 Create `proto/offer/v1/service.proto`
- [x] 2.2 Define `OfferService` with Plan/Schedule APIs
- [x] 2.3 Generate Ruby and TypeScript stubs

## 3. Plan Migration

- [x] 3.1 Create `cast_plans` relation in Offer slice
- [x] 3.2 Create `SavePlans` use case in Offer slice
- [x] 3.3 Create `PlanPresenter` in Offer slice
- [x] 3.4 Create `SavePlansContract` in Offer slice
- [x] 3.5 Implement `OfferService.SavePlans` gRPC endpoint
- [x] 3.6 Implement `OfferService.GetPlans` gRPC endpoint

## 4. Schedule Migration

- [x] 4.1 Create `cast_schedules` relation in Offer slice
- [x] 4.2 Create `SaveSchedules` use case in Offer slice
- [x] 4.3 Create `SchedulePresenter` in Offer slice
- [x] 4.4 Create `SaveSchedulesContract` in Offer slice
- [x] 4.5 Implement `OfferService.SaveSchedules` gRPC endpoint
- [x] 4.6 Implement `OfferService.GetSchedules` gRPC endpoint

## 5. Frontend Migration

- [x] 5.1 Create `modules/offer/` directory structure (N/A - API routes pattern used)
- [x] 5.2 Move Plan-related components and hooks (N/A - components remain in portfolio UI)
- [x] 5.3 Move Schedule-related components and hooks (N/A - components remain in portfolio UI)
- [x] 5.4 Add `offerClient` to `lib/grpc.ts`
- [x] 5.5 Update `/api/guest/casts/[id]` to use parallel calls (Portfolio + Offer)
- [x] 5.6 Update `/api/cast/plans` to use offerClient
- [x] 5.7 Update `/api/cast/schedules` to use offerClient

## 6. Documentation

- [x] 6.1 Update `openspec/project.md` domain table
- [x] 6.2 Update `services/handbooks/workspace/docs/domains/README.md`
- [x] 6.3 Update `services/handbooks/workspace/docs/domains/portfolio.md`
- [x] 6.4 Finalize `services/handbooks/workspace/docs/domains/offer.md`
- [x] 6.5 Update `CLAUDE.md` if necessary (N/A - no changes needed)

## 7. Cleanup

- [x] 7.1 Remove Plan/Schedule APIs from Portfolio gRPC handler
- [x] 7.2 Remove Plan/Schedule use cases from Portfolio slice
- [x] 7.3 Run tests and verify functionality

## 8. Database Migration

- [x] 8.1 Create migration to rename `portfolio__cast_plans` → `offer__cast_plans`
- [x] 8.2 Create migration to rename `portfolio__cast_schedules` → `offer__cast_schedules`
- [x] 8.3 Update Offer relations to use `offer__` prefix
- [x] 8.4 Update Portfolio relations to reference `offer__` tables
- [x] 8.5 Run migration
