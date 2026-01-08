# Design: Profile Preview Architecture

## Component Reuse Strategy
To avoid code duplication between the "Real" Guest Page and the "Preview" Modal, we will refactor the presentation components to be "Dumb Components" (Presentational) that take data as props, with "Smart" wrappers or hooks handling the data fetching for the real page.

### Current Architecture
`CastDetailPage` -> `PhotoGallery` (fetches/derives from ID)
`CastDetailPage` -> `ProfileSpecs` (fetches/derives from ID)

### Proposed Architecture
1. **Presentational Components (Pure)**
   - `PhotoGallery({ images })`
   - `ProfileSpecs({ profileData })`

2. **Guest Page (`app/(guest)/cast/[id]/page.tsx`)**
   - Fetches data (or uses huge mocks currently).
   - Passes data to generic components.

3. **Preview Modal (`ProfilePreviewModal`)**
   - Takes `ProfileFormData` from `ProfileEditPage`.
   - Adapts `ProfileFormData` to the shape expected by `ProfileSpecs`.
   - Passes adapted data to generic components.

## Data Adaptation
`ProfileFormData` needs to be mapped to the display format (e.g., combining start/end times into schedule display, formatting social links).
