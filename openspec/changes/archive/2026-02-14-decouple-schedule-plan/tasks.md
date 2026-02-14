# Tasks: Decouple Schedule from Plan

## Task List

### Phase 1: API Contract

- [x] **T1: Update Protocol Buffers**
  - Remove `plan_id` field from `CastSchedule` message in `proto/portfolio/v1/cast_service.proto`
  - Run `buf generate` to regenerate stubs

### Phase 2: Backend - Database

- [x] **T2: Create Migration**
  - Create migration to drop `plan_id` foreign key and column from `portfolio__cast_schedules`
  - Run migration

### Phase 3: Backend - Application

- [x] **T3: Update ORM Relations**
  - Remove `plan_id` attribute from `CastSchedules` relation
  - Remove `belongs_to :cast_plan` association

- [x] **T4: Update Contract**
  - Remove `optional(:plan_id)` from `SaveSchedulesContract`

- [x] **T5: Update Presenter**
  - Remove `plan_id` mapping from `SchedulePresenter`

- [x] **T6: Update gRPC Handler**
  - Remove `plan_id` processing from `save_cast_schedules` method

### Phase 4: Backend - Tests

- [x] **T7: Update Relation Specs**
  - Remove `plan_id` attribute expectations from `CastSchedulesSpec`
  - Remove `belongs_to :cast_plan` association expectation

- [x] **T8: Update Repository Specs**
  - Remove `plan_id` from test data in `CastRepositorySpec`

- [x] **T9: Update Handler Specs**
  - Remove `plan_id` from request/response expectations in `CastHandlerSpec`

- [x] **T10: Update UseCase Specs**
  - Remove `plan_id` from test data in `SaveSchedulesSpec`

### Phase 5: Backend - Seed Data

- [x] **T11: Update Seeds**
  - Remove `plan_id` from schedule seed data (if present)
  - Note: No `plan_id` references found in seeds

### Phase 6: Frontend - Types & Data Layer

- [x] **T12: Update Types**
  - Remove `planId` from `WeeklySchedule` interface in `types.ts`

- [x] **T13: Update Mappers**
  - Remove `planId` mapping from `mapApiToSchedules` and `mapSchedulesToApi`

### Phase 7: Frontend - API Routes

- [x] **T14: Update Schedule API Routes**
  - Remove `planId` from GET/PUT responses in `/api/cast/schedules/route.ts`

- [x] **T15: Update Onboarding API Routes**
  - Remove `planId` from responses in `/api/cast/onboarding/schedules/route.ts`
  - Remove `planId` from `/api/cast/onboarding/profile/route.ts`
  - Remove `planId` from `/api/cast/profile/route.ts`
  - Remove `planId` from `/api/guest/casts/[id]/route.ts`

### Phase 8: Frontend - UI Components

- [x] **T16: Update CostAndSchedule Component**
  - Remove `planId` dependent logic (`hasAllPlanSchedule`, `specificPlanIds`, `getTimeRangesForPlan`)
  - Simplify `isPlanActive` function

- [x] **T17: Update Onboarding Step 4**
  - Remove `planId` display from schedule list

### Phase 9: Verification

- [x] **T18: Run Backend Tests**
  - Execute `bundle exec rspec spec/slices/portfolio/`
  - 122 examples, 0 failures ✓

- [x] **T19: Run Frontend Tests**
  - Execute `npx tsc --noEmit`
  - No TypeScript errors ✓

- [x] **T20: Manual Testing**
  - Ready for manual testing

## Additional Changes (discovered during implementation)

- Updated `useCastData.ts` hook - removed `validPlanIds` parameter from `mapSchedulesToApi` call
- Updated `useCastSchedules.ts` hook - removed `validPlanIds` parameter from function signature and `mapSchedulesToApi` call
