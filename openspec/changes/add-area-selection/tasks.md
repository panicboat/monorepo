# Tasks

## Backend - Database

- [ ] Create migration for `portfolio__areas` table
- [ ] Create migration for `portfolio__cast_areas` join table
- [ ] Create seed data for initial ~30 areas
- [ ] Add `Areas` relation in Portfolio slice
- [ ] Add `CastAreas` relation in Portfolio slice
- [ ] Update `Casts` relation with `has_many :areas, through: :cast_areas`

## Backend - Repository & Use Cases

- [ ] Create `AreaRepository` with `list_all`, `list_by_prefecture`, `find_by_code`
- [ ] Update `CastRepository` to handle area associations
- [ ] Update `SaveProfile` use case to save selected area IDs
- [ ] Update `GetProfile` use case to include areas in response
- [ ] Add `ListAreas` RPC to expose area master data

## Backend - Proto & Presenter

- [ ] Add `Area` message type (id, prefecture, name, code)
- [ ] Add `areas` repeated field to `CastProfile` message
- [ ] Add `ListAreasRequest/Response` messages
- [ ] Update `ProfilePresenter` to include areas
- [ ] Regenerate Ruby proto stubs

## Frontend - Types & API

- [ ] Add `Area` type to frontend types
- [ ] Regenerate TypeScript proto stubs
- [ ] Create `useAreas` hook to fetch area master
- [ ] Update profile mappers to handle areas

## Frontend - UI Components

- [ ] Create `AreaSelector` component (prefecture dropdown + area multi-select)
- [ ] Add area selection to onboarding step (replace free text input)
- [ ] Add area selection to profile edit page
- [ ] Display selected areas on cast profile (guest view)

## Migration Strategy

- [ ] Keep legacy `area` column temporarily for backward compatibility
- [ ] Add migration script to convert existing area text to area_ids (if needed)
