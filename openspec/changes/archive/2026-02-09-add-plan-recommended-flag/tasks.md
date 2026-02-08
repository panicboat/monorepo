# Tasks

## 1. Database Migration

- [x] 1.1 Create migration to add `is_recommended` column to `portfolio__cast_plans`
- [x] 1.2 Add seed data for plans with recommended flag

## 2. Backend Implementation

- [x] 2.1 Update Proto definition (`CastPlan` message, `SaveCastPlansRequest`)
- [x] 2.2 Regenerate gRPC code
- [x] 2.3 Update `SaveCastPlans` server action to handle `is_recommended` flag
- [x] 2.4 Add logic to ensure only one plan is recommended per cast (or allow multiple based on design)

## 3. Frontend - Cast Management

- [x] 3.1 Update `PlanEditor` component to include recommended toggle/checkbox
- [x] 3.2 Ensure only one plan can be marked as recommended in UI
- [x] 3.3 Update form submission to include `is_recommended` field

## 4. Frontend - Guest View

- [x] 4.1 Update `CostAndSchedule` component to display recommended badge
- [x] 4.2 Sort plans to show recommended plan first
- [x] 4.3 Add visual styling for recommended badge

## 5. Testing

- [x] 5.1 TypeScript type check passed
- [x] 5.2 Add `is_recommended` attribute test to `cast_plans_spec.rb`
- [x] 5.3 Add `is_recommended` flag test to `save_plans_spec.rb`
- [x] 5.4 Create `plan_presenter_spec.rb` for PlanPresenter tests
