# データモデル

テーブルは slice ごとに PostgreSQL の schema（`identity`、`profile`、`post` など）へ分かれている。
slice をまたぐ参照（例: `post.posts.author_profile_id` → `profile.profiles.id`）は FK 制約を持たず、値の一致だけで結ぶ。
FK 制約があるのは同一 slice 内の親子関係（`post` の投稿とその子テーブル、`karte.events`、`review.events`）のみ。

## Overview

slice をまたぐ主要な参照を示す。
点線は FK 制約のない参照、ルートテーブルは account と profile。

```mermaid
erDiagram
    identity_accounts ||..o{ profile_profiles : "account_id"
    identity_accounts ||..o| billing_customers : "account_id"
    identity_accounts ||..o| billing_subscriptions : "account_id"
    identity_accounts ||..o{ notifications_push_subscriptions : "account_id"
    identity_accounts ||..o{ media_files : "owner_account_id"
    identity_accounts ||..o{ karte_kartes : "author_account_id"
    identity_accounts ||..o{ review_reviews : "author_account_id"
    profile_profiles ||..o{ post_posts : "author_profile_id"
    profile_profiles ||..o{ schedule_schedules : "profile_id"
    profile_profiles ||..o{ social_follows : "follower / followee"
    profile_profiles ||..o{ social_blocks : "blocker / blocked"
    profile_profiles ||..o{ bookmarks_bookmarks : "profile_id"
    post_posts ||..o{ bookmarks_bookmarks : "post_id"
    profile_profiles ||..o{ footprints_visits : "visitor / visited"
    profile_profiles ||..o{ messaging_threads : "profile_a / profile_b"
    profile_profiles ||..o{ notifications_notifications : "recipient_profile_id"
    profile_profiles ||..o{ notifications_push_subscriptions : "profile_id"
    post_posts |o..o| schedule_schedules : "post_id"
    post_posts ||..o{ notifications_notifications : "target_post_id"
    profile_profiles ||..o{ karte_kartes : "author / target profile"
    profile_profiles ||..o{ review_reviews : "author / target profile"
    profile_profiles ||..o{ media_files : "uploader_profile_id"
```

## Identity

アカウント（ログイン単位）の状態を持つ。

```mermaid
erDiagram
    identity_accounts {
        uuid id PK
        integer role "1: ゲスト, 2: キャスト"
        timestamptz deactivated_at "退会日時"
    }
```

- `identity.accounts`: ログイン単位のアカウント。
  - ロールと退会日時を持つ。
  - 退会から 90 日を過ぎると削除処理で消える。

[アカウント](features/account.md)

## Profile

プロフィール（1 アカウントが複数持てる人格）と、キャスト固有の項目。

```mermaid
erDiagram
    profile_profiles {
        uuid id PK
        uuid account_id "参照（FK なし）"
        uuid avatar_media_id "参照（FK なし）"
        uuid cover_media_id "参照（FK なし）"
        boolean is_private "非公開プロフィール"
        boolean follow_approval_required "フォローに承認が必要"
        varchar prefecture "主要エリア（都道府県）"
        text area "都道府県内のエリア"
        timestamptz disabled_at "無効化日時"
    }
    profile_casts {
        uuid profile_id PK "参照（FK なし）"
        integer age
        jsonb body_stats
    }
    profile_profiles ||..o| profile_casts : "profile_id"
```

- `profile.profiles`: プロフィール本体。
  - 公開範囲（`is_private`）とフォロー承認の要否を持つ。
- `profile.casts`: キャストのプロフィールだけが持つ補足情報（年齢、体型など）。

[プロフィール](features/profiles.md)

## Post

投稿とその添付、メンション、いいね、コメント。

```mermaid
erDiagram
    post_posts {
        uuid id PK
        uuid author_profile_id "参照（FK なし）"
        text visibility "public / private"
        timestamptz published_at "公開開始"
        timestamptz expires_at "公開終了、NULL は無期限"
    }
    post_post_media {
        uuid id PK
        uuid post_id FK
        uuid media_id "参照（FK なし）"
    }
    post_hashtags {
        uuid id PK
        uuid post_id FK
        varchar tag
    }
    post_post_mentions {
        uuid id PK
        uuid post_id FK
        uuid profile_id "参照（FK なし）"
    }
    post_likes {
        uuid id PK
        uuid post_id FK
        uuid profile_id UK "参照（FK なし）、post_id と組で一意"
    }
    post_comments {
        uuid id PK
        uuid post_id FK
        uuid parent_id FK "返信先コメント"
        uuid author_profile_id "参照（FK なし）"
    }
    post_comment_media {
        uuid id PK
        uuid comment_id FK
        uuid media_id "参照（FK なし）"
    }
    post_comment_mentions {
        uuid id PK
        uuid comment_id FK
        uuid profile_id "参照（FK なし）"
    }
    post_posts ||--o{ post_post_media : "post_id"
    post_posts ||--o{ post_hashtags : "post_id"
    post_posts ||--o{ post_post_mentions : "post_id"
    post_posts ||--o{ post_likes : "post_id"
    post_posts ||--o{ post_comments : "post_id"
    post_comments ||--o{ post_comments : "parent_id"
    post_comments ||--o{ post_comment_media : "comment_id"
    post_comments ||--o{ post_comment_mentions : "comment_id"
```

- `post.posts`: 投稿本体。
  - 公開範囲（`visibility`）と表示期間（`published_at` から `expires_at` まで）を持つ。
- `post.post_media`: 投稿に添付したメディア。
  - メディアを削除しても、そのメディアを指す添付の行は消えない。
    - 行は残り、配信 URL は空になる。
- `post.hashtags`: 投稿のハッシュタグ。
- `post.post_mentions`: 投稿本文中のメンション（対象プロフィール）。
- `post.likes`: 投稿へのいいね。
- `post.comments`: コメント。
  - `parent_id` で返信を表す。
  - 親コメントを削除すると、他のプロフィールの返信も削除される。
    - 返信の添付とメンションも同時に削除される。
  - 投稿のコメント数は、返信（`parent_id` のあるコメント）を含まない。
- `post.comment_media`: コメントに添付したメディア。
- `post.comment_mentions`: コメント本文中のメンション。

[投稿](features/posts.md)

## Social

フォローとブロック。
どちらもプロフィール同士の関係。

```mermaid
erDiagram
    social_follows {
        uuid id PK
        uuid follower_profile_id UK "参照（FK なし）、followee と組で一意"
        uuid followee_profile_id UK "参照（FK なし）、follower と組で一意"
        text status "pending / approved"
    }
    social_blocks {
        uuid id PK
        uuid blocker_profile_id UK "参照（FK なし）、blocked と組で一意"
        uuid blocked_profile_id UK "参照（FK なし）、blocker と組で一意"
    }
```

- `social.follows`: フォロー関係。
  - `status` が `pending` の間は承認待ち、`approved` で成立する。
- `social.blocks`: ブロック関係。

[フォロー・ブロック](features/follows-and-blocks.md)

## Schedule

キャストの予定（日付と時間帯）。
投稿と 1 対 1 で結べる。

```mermaid
erDiagram
    schedule_schedules {
        uuid id PK
        uuid profile_id UK "参照（FK なし）、work_date と組で一意"
        date work_date UK "営業日"
        varchar start_time "HH:MM"
        varchar end_time "HH:MM"
        uuid post_id UK "参照（FK なし）、予定のお知らせ投稿"
    }
```

- `schedule.schedules`: 予定。
  - プロフィールと営業日ごとに 1 件。
  - `post_id` が入ると、その投稿を予定のお知らせとして扱う。

[予定](features/schedules.md)

## Feed

slice 内にテーブル定義（relation）を持たない。

[フィード・ランキング](features/feed-and-ranking.md)

## Discovery

slice 内にテーブル定義（relation）を持たない。

[検索](features/search.md)

## Bookmarks

ブックマーク。

```mermaid
erDiagram
    bookmarks_bookmarks {
        uuid id PK
        uuid profile_id UK "参照（FK なし）、post_id と組で一意"
        uuid post_id UK "参照（FK なし）、profile_id と組で一意"
    }
```

- `bookmarks.bookmarks`: プロフィールがブックマークした投稿。

[ブックマーク](features/bookmarks.md)

## Footprints

足あと（訪問の記録）と、足あとの既読状態。

```mermaid
erDiagram
    footprints_visits {
        uuid id PK
        uuid visitor_profile_id UK "参照（FK なし）、visited_profile_id と組で一意"
        uuid visited_profile_id UK "参照（FK なし）、visitor_profile_id と組で一意"
        timestamptz last_visited_at
        integer visit_count
    }
    footprints_read_states {
        uuid profile_id PK "参照（FK なし）"
        timestamptz last_read_visit_at
    }
```

- `footprints.visits`: 訪問者と訪問先の組ごとに 1 件。
  - 最終訪問日時と訪問回数を持つ。
- `footprints.read_states`: プロフィールごとの足あとの既読位置。

[足あと](features/footprints.md)

## Messaging

メッセージのスレッド、メッセージ、既読位置。

```mermaid
erDiagram
    messaging_threads {
        uuid id PK
        uuid profile_a UK "参照（FK なし）、profile_b と組で一意"
        uuid profile_b UK "参照（FK なし）、profile_a と組で一意"
        timestamptz last_message_at
    }
    messaging_messages {
        uuid id PK
        uuid thread_id "参照（FK なし）"
        uuid sender_profile_id "参照（FK なし）"
        text content
    }
    messaging_read_states {
        uuid thread_id PK "参照（FK なし）"
        uuid profile_id PK "参照（FK なし）"
        uuid last_read_message_id "参照（FK なし）"
    }
    messaging_threads ||..o{ messaging_messages : "thread_id"
    messaging_threads ||..o{ messaging_read_states : "thread_id"
```

- `messaging.threads`: 2 プロフィール間のスレッド。
  - 組ごとに 1 件。
- `messaging.messages`: スレッド内のメッセージ。
- `messaging.read_states`: スレッドごと、プロフィールごとの既読位置。

[メッセージ](features/messages.md)

## Notifications

通知、通知の設定、プッシュ通知の購読先。

```mermaid
erDiagram
    notifications_notifications {
        uuid id PK
        uuid recipient_profile_id UK "参照（FK なし）、type と target_resource_id と組で一意"
        text type UK "通知の種類"
        uuid target_resource_id UK "通知対象のリソース"
        uuid target_post_id "参照（FK なし）"
        uuid latest_actor_profile_id "参照（FK なし）"
        timestamptz latest_event_at "最新の発火時刻"
        integer actor_count
        timestamptz read_at
    }
    notifications_preferences {
        uuid profile_id PK "参照（FK なし）"
        boolean comment
        boolean like
        boolean reply
        boolean follow
        boolean mention
        boolean message
        boolean footprint_unread_badge
        boolean footprints_record_my_visits
    }
    notifications_push_subscriptions {
        uuid id PK
        uuid account_id "参照（FK なし）"
        uuid profile_id UK "参照（FK なし）、endpoint と組で一意"
        text endpoint UK "profile_id と組で一意"
    }
```

- `notifications.notifications`: 受信者ごとの通知。
  - 同じ種類・対象の通知は 1 件にまとめられ、`actor_count` で件数を持つ。
    - 同じプロフィールによる繰り返しの発火も件数に含まれる。
- `notifications.preferences`: プロフィールごとの通知の設定と足あとの設定。
  - 種類別の設定はプッシュ通知の送信だけを制御する。
- `notifications.push_subscriptions`: プロフィールごと・ブラウザごとのプッシュ通知の購読先。
  - endpoint とプロフィールの組で 1 件。
  - `account_id` は、別のアカウントが同じ端末を使い始めたときと、アカウントの削除処理で購読を消すのに使う。

[通知](features/notifications.md)

## Media

アップロードされたメディアファイル。

```mermaid
erDiagram
    media_files {
        uuid id PK
        uuid uploader_profile_id "参照（FK なし）"
        uuid owner_account_id "参照（FK なし）"
        varchar media_type "image / video、それ以外は unknown"
        text media_key
        text thumbnail_key
    }
```

- `media.files`: メディアファイル。
  - アップロードしたプロフィールとアカウントを持つ。

[メディア](features/media.md)

## Karte

カルテ。
対象プロフィールに対する記録を持つ。

```mermaid
erDiagram
    karte_kartes {
        uuid id PK
        uuid author_account_id "参照（FK なし）"
        uuid author_profile_id "参照（FK なし）"
        uuid target_profile_id "参照（FK なし）"
        smallint rating "1〜5、NULL は未評価"
        timestamptz last_activity_at "活動日時（作成と出来事の追加で更新）"
        date last_occurred_on "最終の出来事の日付"
    }
    karte_events {
        uuid id PK
        uuid karte_id FK
        text stage "reservation / service / aftercare"
        text outcome
        date occurred_on
        text note
        text[] tags
    }
    karte_kartes ||--o{ karte_events : "karte_id"
```

- `karte.kartes`: カルテ 1 件。
  - 作成者（アカウントとプロフィール）と対象プロフィールを持つ。
  - 評価は `rating` に入る。
- `karte.events`: カルテに記録した出来事（段階と結果）。

[カルテ](features/karte.md)

## Review

クチコミ。
カルテと同じ構造で、評価は 1〜5 の整数。

```mermaid
erDiagram
    review_reviews {
        uuid id PK
        uuid author_account_id "参照（FK なし）"
        uuid author_profile_id "参照（FK なし）"
        uuid target_profile_id "参照（FK なし）"
        smallint rating "1〜5、NULL は未評価"
        timestamptz last_activity_at "活動日時（作成と出来事の追加で更新）"
        date last_occurred_on "最終の出来事の日付"
    }
    review_events {
        uuid id PK
        uuid review_id FK
        text stage "reservation / service / aftercare"
        text outcome
        date occurred_on
        text note
        text[] tags
    }
    review_reviews ||--o{ review_events : "review_id"
```

- `review.reviews`: クチコミ 1 件。
  - 作成者（アカウントとプロフィール）と対象プロフィールを持つ。
- `review.events`: クチコミに記録した出来事（段階と結果）。

[クチコミ](features/reviews.md)

## Billing

課金。
アカウント単位で Stripe の顧客と契約を持つ。
課金の行は、アカウントの削除処理の対象にならず、削除後も残る。

```mermaid
erDiagram
    billing_customers {
        uuid id PK
        uuid account_id UK "参照（FK なし）"
        text stripe_customer_id UK
    }
    billing_subscriptions {
        uuid id PK
        uuid account_id UK "参照（FK なし）"
        text stripe_subscription_id UK
        text stripe_price_id
        text status
        timestamptz current_period_end
        boolean cancel_at_period_end
    }
    billing_stripe_events {
        uuid id PK
        text stripe_event_id UK
        text event_type
        timestamptz processed_at
        text error_message
    }
```

- `billing.customers`: アカウントと Stripe 顧客の対応。
  - アカウントごとに 1 件。
- `billing.subscriptions`: アカウントの契約。
  - アカウントごとに 1 件。
  - 現在の期間の終了日時と期間末での解約予定を持つ。
- `billing.stripe_events`: 受信した Stripe のイベント。
  - 処理日時とエラーを持つ。
  - 受信したイベントの全体を `payload` に保存する。

[課金](features/billing.md)
