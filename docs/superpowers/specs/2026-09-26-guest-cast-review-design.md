# Guest による Cast レビュー Design

Date: 2026-09-26
Status: Design spec (implementation-ready)
Scope: [GitHub Issue #1232](https://github.com/panicboat/monorepo/issues/1232) を起点に、Guest が Cast にレビュー（星評価 + テキスト）を投稿できる機能を新規 slice (`review`) として greenfield 構築する。

## Concept

review は Guest (author) が Cast (target) を評価する、双方に公開されるレビュー DB。

- **方向**: karte（Cast→Guest、非公開の自己防衛カルテ）とは逆方向・逆スコープ。同一 slice に混在させず、別の greenfield slice として構築する（karte の design spec に明記の通り）
- **書き手**: 登録済み Guest。事前の予約実績等の接点は要求しない（`schedule` slice に予約完結を追跡する仕組みが現状ないため、制限を設けようがない）
- **読み手**: プロフィール閲覧者全員（Guest の「書いたレビュー」タブ・Cast の「受信レビュー」タブ、どちらも既存の「投稿」「いいね」タブと同じ公開レベル）
- **課金**: 「Cast 側の他者レビューを将来課金プランにする」という issue 記載の構想は、本 spec のスコープ外（表示制御を今回実装しない）

## Decisions

| 項目 | 決定 |
|---|---|
| 対象方向 | Guest (author) → Cast (target)。karte とは別 slice |
| 評価項目 | `rating`（0.5刻み、1.0〜5.0の10値）+ `body`（任意テキスト） |
| レビュー資格 | 制限なし。予約実績等のゲートなし |
| 多重度 | 制限なし（同一 Guest×Cast に対し時系列で何度でも投稿可、karte と同じ方針） |
| Cast のレビュー受付可否 (`accepts_reviews`) | デフォルト ON（オプトアウト方式）。既存 Cast にも適用 |
| `accepts_reviews` の効果範囲 | **書き込みはブロックしない。公開可否のみを制御する**（詳細は可視性セクション） |
| 「レビューを書く」CTA | Cast の `accepts_reviews` に関わらず常に表示 |
| per-entry 非表示 (`hidden`) | Cast が entry 単位で切り替え可能。第三者からは見えなくなるが、書いた Guest 本人には見え続ける。状態を示すバッジ等の UI は不要 |
| Guest 側一覧の可視性 | プロフィール閲覧者全員に公開（既存「投稿」「いいね」タブと同じ） |
| Cast 側一覧の可視性 | 同上、全員に公開 |
| 課金境界（他者レビューの有料化） | 本 spec のスコープ外 |
| report / 通報機能 | MVP では不要（Cast の非表示で十分と判断） |
| 集計表示（平均★・件数） | MVP では含めない（個別レビュー一覧のみ） |
| karte との導線・abuse対策・命名の統一 | 本 spec のスコープ外（将来別途検討） |
| `cast_settings` の所属 slice | `review` slice（`profile` ではない） |
| スライス間アクセス方法 | 既存 precedent を踏襲。統一は [#1233](https://github.com/panicboat/monorepo/issues/1233) で別途トラッキング |

### `cast_settings` を `review` slice に置く理由

`profile__casts`（`sns_links` / `age` / `body_stats` / `industry`）は表示・プロフィール情報のみを持ち、機能ごとの挙動フラグを扱っていない。karte も同じ理由で `karte__access` を `karte` slice 側に置いている（karte design spec: 「`karte__access` は別 table で `granted_at` を持つ。後で `expires_at` や `plan_id` を加える形で Stripe 等を後付け可」）。`accepts_reviews` も現時点では 1 boolean だが、将来の課金プラン用カラム追加を見据えて `review` slice 側に独立させる。

## 可視性ルール

書き込みは常に成功する（`target.role == CAST` の検証のみ）。可視性は以下の統一ルールで、`ListEntriesByTarget` と `ListEntriesByAuthor` の両方に同じ形で適用する。

**self-view**: `viewer_account_id == page_owner_account_id`（Guest が自分の「書いたレビュー」タブを見ている／Cast が自分の「受信レビュー」タブを見ている）の場合、`hidden` や `accepts_reviews` の状態に関わらず全件を返す。

self-view でない場合、以下を全て満たす entry のみ表示する。

1. **Level A（review ドメイン固有、viewer に非依存）**: `NOT hidden AND accepts_reviews[target]`（`accepts_reviews` は target の現在の設定を都度参照する。過去に NG だった時点で書かれた entry でも、Cast が後から opt-in すれば公開されうる）
2. **Level B1（social、page_owner 基準、リスト全体で1回だけ判定）**: 既存の `Social::UseCases::FilterVisiblePosts`（`dystopia/monolith/slices/social/use_cases/filter_visible_posts.rb`）を `page_owner_account_id` 1件について呼び出し、viewer が page_owner のコンテンツを見られるか（block・非公開プロフィール+フォロー状態）を判定する。page_owner はリスト呼び出し内で固定値なので、entry ごとに呼ぶ必要はない
3. **Level B2（social、もう一方の当事者との block、entry ごとにバッチ判定）**: `Social::Slice["repositories.block_repository"].bidirectionally_blocked_ids` を使い、viewer と「もう一方の当事者」（target-list なら各 entry の author、author-list なら各 entry の target）との bidirectional block を entry ごとに除外する

非公開プロフィールの判定は page_owner 側のみに適用し、もう一方の当事者の私設アカウント状態は考慮しない（レビューは page_owner のページに掲載される公開コンテンツとして扱う）。block はどちらの当事者との関係でも成立しうる（page_owner 経由・もう一方の当事者経由のどちらの閲覧ルートも塞ぐ）。

### Level B の実装方針

新しい social ロジックを追加しない。既存資産をそのまま再利用する。

- Level B1: `Social::Slice["use_cases.filter_visible_posts"]` を呼ぶ（use_case 経由、既存 precedent: `Social::UseCases::FilterVisiblePosts` は `Profile::Slice["use_cases.get_profile"]` を use_case 経由で呼んでいる）
- Level B2: `Social::Slice["repositories.block_repository"].bidirectionally_blocked_ids` を直接呼ぶ（repository 直呼び、既存 precedent: `dystopia/monolith/slices/post/adapters/block_adapter.rb`）

`bidirectionally_blocked_ids` を repository 直呼びする設計は、本来であれば use_case 経由が望ましいという指摘があったが、既存コードベースでも repository 直呼びと use_case 経由が混在しており明文化された規約がないため、本 spec では既存 precedent（`block_adapter.rb` 型）に倣う。規約の統一は [#1233](https://github.com/panicboat/monorepo/issues/1233) でスコープ外として別トラッキングする。

Review 側では `Review::Adapters::BlockAdapter` を新設し、`Post::Adapters::BlockAdapter` と同じ形で `Social::Slice["repositories.block_repository"]` をラップする。Review の use_case はこの adapter のみを触り、Social の repository を直接参照しない（Review slice 内部の層構造は維持する）。

## A. Schema (backend)

新規 migrations。

### `review__entries`

| column | type | note |
|---|---|---|
| `id` | uuid | PK |
| `author_account_id` | uuid | NOT NULL（Guest）。FK 相当（identity__users、cross-schema のため実 FK は貼らない、既存 convention） |
| `target_account_id` | uuid | NOT NULL（Cast）。同上 |
| `rating` | numeric(2,1) | NOT NULL、CHECK で `0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0` の10値に制限 |
| `body` | text | NULL可、最大500文字（contract 層で検証、karte と同じ上限） |
| `hidden` | boolean | NOT NULL DEFAULT false |
| `created_at` / `updated_at` | timestamptz | NOT NULL DEFAULT now |

index:
- `(target_account_id, created_at DESC, id DESC)` = Cast 受信一覧の主経路（`ListEntriesByTarget`）
- `(author_account_id, created_at DESC, id DESC)` = Guest 投稿一覧の主経路（`ListEntriesByAuthor`）

target role 検証は karte 同様 DB 制約でなく use_case 層で `target.role == CAST` を要求する。重複制約はなし（時系列で複数 entry を許可）。

### `review__cast_settings`

| column | type | note |
|---|---|---|
| `account_id` | uuid | PK（Cast） |
| `accepts_reviews` | boolean | NOT NULL DEFAULT true |
| `updated_at` | timestamptz | NOT NULL DEFAULT now |

行が存在しない Cast は `accepts_reviews = true` とみなす（karte の `karte__access` とは逆に、レコードなし = 有効）。Cast の self-serve トグルから upsert される（karte の DB 直 SQL 運用とは異なる経路）。

## B. Repositories

- `entry_repository`: `create` / `update` / `delete` / `find_by_id` / `list_by_target`（cursor） / `list_by_author`（cursor） / `hide` / `unhide`
- `cast_settings_repository`: `find_by_account`（nilなら呼び出し側で `accepts_reviews: true` とみなす） / `upsert`

cursor は既存 slice の `(created_at, id)` 複合 cursor を踏襲。

## C. Use cases

- `CreateEntry`: `target.role == CAST` のみ検証。`accepts_reviews` によるブロックなし
- `UpdateEntry` / `DeleteEntry`: author のみ実行可
- `HideEntry` / `UnhideEntry`: target のみ実行可。`review__entries.hidden` を切り替えるだけ
- `ListEntriesByTarget(target_account_id, viewer_account_id)`: repo から target 基準で raw 行を取得 → `page_owner_account_id = target` として `FilterVisibleEntries` に委譲
- `ListEntriesByAuthor(author_account_id, viewer_account_id)`: repo から author 基準で raw 行を取得 → `page_owner_account_id = author` として `FilterVisibleEntries` に委譲
- `FilterVisibleEntries(viewer_account_id:, page_owner_account_id:, entries:)`: 可視性ルールセクションの Level A / self-view / B1 / B2 を実装する内部 use case
- `GetMySettings` / `UpdateMySettings`: `accepts_reviews` の読み書き（Cast本人のみ）

## D. Cross-slice adapters

- `Profile::Slice["use_cases.get_profile"]`（もしくは同等）: `target.role == CAST` 検証、表示用プロフィール hydration
- `Social::Slice["use_cases.filter_visible_posts"]`: Level B1
- `Review::Adapters::BlockAdapter` → `Social::Slice["repositories.block_repository"]`: Level B2
- `Media` 相当: entry 表示時のアバター等 hydration（karte の `media_adapter.rb` と同様）

## E. proto / gRPC

`proto/dystopia/review` パッケージを新設（karte と同構成）。

RPC: `CreateEntry` / `UpdateEntry` / `DeleteEntry` / `HideEntry` / `UnhideEntry` / `ListEntriesByTarget` / `ListEntriesByAuthor` / `GetMySettings` / `UpdateMySettings`

**実装時の既知の落とし穴**: karte 実装時に `bin/grpc` への Gruf handler 登録漏れが実際に発生している。新 handler の登録を implementation plan のチェック項目に明記すること。

## F. Frontend

- `modules/review/components/`: `ReviewComposer`（星入力0.5刻み + テキスト）、`ReviewEntryCard`、`ReviewsTab`
- `modules/review/hooks/`: 各 use case に対応する hook 一式
- `ProfileContentTabs`（`dystopia/frontend/src/modules/post/components/ProfileContentTabs.tsx`）の `extraTabs` に注入。karte と異なり Cast/Guest どちらの profile でも常時表示し、ラベルを Guest側「書いたレビュー」／Cast側「受信レビュー」で出し分ける
- `settings/reviews/page.tsx` を新設し `accepts_reviews` トグルを配置（既存の `settings/blocks`、`settings/follow-requests` と同じ構成パターン）
- Cast プロフィール上の「レビューを書く」CTA は `accepts_reviews` の値に関わらず常時表示

## G. Error handling

- `target.role != CAST` での `CreateEntry` → validation error
- entry not found（`UpdateEntry` / `DeleteEntry` / `HideEntry` / `UnhideEntry`） → not_found error
- author 以外による `UpdateEntry` / `DeleteEntry` → permission error
- target 以外による `HideEntry` / `UnhideEntry` → permission error
- `rating` が許可された10値以外 → validation error（クライアント側も固定ステップの星入力 UI で担保）
- `body` が500文字超過 → validation error

## H. Testing

karte の spec 構成（use_case / repository / handler の request spec）を踏襲する。

- `FilterVisibleEntries` は `accepts_reviews × hidden × block(author/target) × private(page_owner) × self-view` の組み合わせを網羅するテストマトリクスを持つ。可視性判定はここに一本化されているため、`ListEntriesByTarget` / `ListEntriesByAuthor` 側では委譲呼び出しの確認のみでよい
- `CreateEntry` が `accepts_reviews = false` でも成功することを明示的にテストする（デフォルト動作と逆の直感になりやすいため）
- frontend: `modules/karte` のテストパターンに倣い hook / component テストを整備する

## I. Out of scope（将来検討）

- 課金境界（Cast 側の他者レビューの有料化）
- karte との導線・abuse対策・命名の統一調整
- report / 通報機能
- 集計表示（平均★・件数）
- スライス間アクセス方法の統一（[#1233](https://github.com/panicboat/monorepo/issues/1233)）

## Grounding

本 worktree 作成時点の `origin/main`（`36fdc36d`）を基点。参照した既存実装:

- `dystopia/monolith/slices/karte/*`: slice 構造（relations/repositories/use_cases/grpc）のテンプレート
- `docs/superpowers/specs/2026-06-27-karte-design.md`: karte の design 方針（silent 設計の理由、`karte__access` を独立テーブルにした理由、trust slice destroy の経緯）
- `dystopia/monolith/slices/social/use_cases/filter_visible_posts.rb`: block / 非公開プロフィールのフィルタ precedent（Level B1 で再利用）
- `dystopia/monolith/slices/post/use_cases/likes/list_liked_posts_by_account.rb`: 「プロフィール所有者ではなくコンテンツの実質的な当事者を基準にフィルタする」precedent
- `dystopia/monolith/slices/post/adapters/block_adapter.rb`: 他スライスの repository を直接ラップする cross-slice adapter precedent（Level B2 で踏襲）
- `dystopia/monolith/slices/profile/relations/casts.rb`（`profile__casts`）: profile slice が表示系情報のみを持つことの確認（`cast_settings` を review slice に置く根拠）
- `dystopia/frontend/src/modules/post/components/ProfileContentTabs.tsx`、`dystopia/frontend/src/app/u/[username]/page.tsx`: 既存タブ構成 / `extraTabs` 注入パターン
- `dystopia/monolith/slices/schedule/`: 予約完結データが存在しないことの確認（レビュー資格を制限なしとした根拠）
