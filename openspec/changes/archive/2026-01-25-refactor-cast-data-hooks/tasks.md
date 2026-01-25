## 1. Create Unified Hooks
- [ ] 1.1 Create `modules/portfolio/hooks/useCastProfile.ts`
  - Fetch profile from `/api/cast/profile`
  - Provide `profile`, `updateProfile`, `saveProfile`
  - Handle loading/error states
- [ ] 1.2 Create `modules/portfolio/hooks/useCastPlans.ts`
  - Fetch plans from `/api/cast/plans`
  - Provide `plans`, `updatePlans`, `savePlans`
- [ ] 1.3 Create `modules/portfolio/hooks/useCastSchedules.ts`
  - Fetch schedules from `/api/cast/schedules`
  - Provide `schedules`, `updateSchedules`, `saveSchedules`
- [ ] 1.4 Create `modules/portfolio/hooks/useCastImages.ts`
  - Handle image upload to S3
  - Provide `uploadImage`, `saveImages`
- [ ] 1.5 Create shared mapping utilities in `modules/portfolio/lib/cast/mappers.ts`

## 2. Migrate Onboarding Pages
- [ ] 2.1 Update `/cast/onboarding/step-1` to use `useCastProfile`
- [ ] 2.2 Update `/cast/onboarding/step-2` to use `useCastImages`
- [ ] 2.3 Update `/cast/onboarding/step-3` to use `useCastPlans`
- [ ] 2.4 Update `/cast/onboarding/step-4` to use `useCastSchedules`
- [ ] 2.5 Update `/cast/onboarding/step-5` to use all hooks
- [ ] 2.6 Update `/cast/onboarding/page.tsx` (main page)

## 3. Migrate Profile/Plans/Schedules Pages
- [ ] 3.1 Update `/cast/profile/page.tsx` to use hooks
- [ ] 3.2 Update `/cast/plans/page.tsx` to use `useCastPlans`
- [ ] 3.3 Update `/cast/schedules/page.tsx` to use `useCastSchedules`

## 4. Cleanup
- [ ] 4.1 Remove `stores/onboarding.ts`
- [ ] 4.2 Remove unused API mapping code
- [ ] 4.3 Update any remaining imports

## 5. Testing
- [ ] 5.1 Verify onboarding flow works end-to-end
- [ ] 5.2 Verify profile editing works
- [ ] 5.3 Verify plans management works
- [ ] 5.4 Verify schedules management works
