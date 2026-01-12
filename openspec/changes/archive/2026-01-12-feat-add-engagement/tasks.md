# Tasks for feature: Engagement (Timeline & History/Reviews)

- [ ] 01_implement_timeline_spec <!-- id: 1 -->
    - [ ] Castのタイムライン投稿機能を定義する。
    - [ ] Guestのタイムライン閲覧機能を定義する。
- [ ] 02_implement_history_reviews_spec <!-- id: 2 -->
    - [ ] Castの履歴閲覧機能を定義する。
    - [ ] Reviewの投稿および一覧表示機能を定義する。
- [x] 03_implementation_frontend <!-- id: 3 -->
    - [x] `CastTimeline` ページ (`/manage/timeline`) を実装する。（`TimelineFeed` 再利用）
    - [x] `CastHistory` ページ (`/manage/history`) を実装する。
    - [x] `CastReviews` ページ (`/manage/reviews`) を実装する。（承認ボタン含む、`ReviewList` 再利用）
    - [ ] Improve Review UX (Status Clarity).
    - [ ] Implement Video Support for Timeline (Feed & Detail).
    - [x] Verify Guest Review UI (`/cast/[id]`) filters by status.
- [ ] 04_implementation_backend (Deferred) <!-- id: 4 -->
    - [ ] `posts` テーブルとAPIを追加する。（今回は対象外）
    - [ ] `reviews` テーブルとAPIを追加する。（今回は対象外）
