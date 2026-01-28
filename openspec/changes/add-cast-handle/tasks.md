# Tasks

## Backend

- [ ] Create migration to add `handle` column to `portfolio__casts` (unique, not null)
- [ ] Update `Casts` relation with `handle` attribute
- [ ] Add `find_by_handle` method to `CastRepository`
- [ ] Add `handle_available?` method to `CastRepository` for uniqueness check
- [ ] Update `SaveProfile` use case to validate and save handle
- [ ] Add handle validation: alphanumeric only, cannot start with number
- [ ] Update `ProfilePresenter` to include handle in response
- [ ] Add `handle` field to `CastProfile` proto message
- [ ] Add `CheckHandleAvailability` RPC for real-time validation
- [ ] Update `GetCastProfile` to support lookup by handle
- [ ] Regenerate Ruby proto stubs

## Frontend

- [ ] Add `handle` field to profile types
- [ ] Regenerate TypeScript proto stubs
- [ ] Create `HandleInput` component with validation and availability check
- [ ] Add handle input to onboarding step-1 (required)
- [ ] Add handle edit to profile edit page
- [ ] Update guest cast profile route from `/casts/[id]` to `/casts/[handle]`
- [ ] Update all internal links to use handle instead of UUID
- [ ] Add real-time handle availability feedback

## Validation Rules

- [ ] Alphanumeric characters only (a-z, A-Z, 0-9)
- [ ] Cannot start with a number
- [ ] Case-insensitive uniqueness (store lowercase)
- [ ] Min/max length TBD (suggest 3-30 characters)
