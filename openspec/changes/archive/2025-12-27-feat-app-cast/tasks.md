# Tasks: Cast Application Features

- [x] [Dashboard] Implement Dashboard Page Structure <!-- id: 1 -->
    - Create `src/app/cast/dashboard/page.tsx` based on `demo`.
    - Implement Header with status selector.
    - Implement "Today's Promise" summary card.
- [x] [Dashboard] Implement MSW Handlers for Dashboard <!-- id: 2 -->
    - Add `GET /api/cast/dashboard` to `src/mocks/handlers/cast.ts`.
- [x] [Onboarding] Implement Onboarding Wizard Component <!-- id: 3 -->
    - Create `src/components/features/cast/OnboardingWizard.tsx`.
    - Implement multi-step logic (Profile -> Photos -> Complete).
- [x] [Onboarding] Implement Onboarding Page <!-- id: 4 -->
    - Create `src/app/cast/onboarding/page.tsx`.
    - Integrate `OnboardingWizard`.
- [ ] [Common] Integrate with Login Flow <!-- id: 5 -->
    - Verify redirection from Login to Dashboard/Onboarding.
