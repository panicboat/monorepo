# Tasks: Cast Profile Edit

- [x] [Profile] Create Profile Edit Page Structure <!-- id: 1 -->
    - Create `src/app/cast/profile/edit/page.tsx`.
    - Implement navigation back to MyPage.
- [x] [Profile] Implement Photo Upload UI <!-- id: 2 -->
    - Create `PhotoUploader` component.
    - Implement add/remove logic (frontend only).
- [x] [Profile] Implement Form Logic <!-- id: 3 -->
    - Implement generic fields (Name, Bio, Tags).
    - Connect to MSW for save action.
- [x] [MSW] Add Profile API Handlers <!-- id: 4 -->
    - Add `GET /api/cast/profile/me` (for edit) and `PUT /api/cast/profile/me`.
