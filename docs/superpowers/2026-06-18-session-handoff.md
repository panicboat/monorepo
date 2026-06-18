# Session Handoff: 2026-06-18

> **Purpose:** Single source of truth for a future session to pick up this project without losing context. Start here.

## 1. Executive Summary

**Product:** 風俗業界全般 (デリヘル / ソープ / 個人活動 など 24 業種) のための SNS プラットフォーム。SNS feed primary、収益化要 = Cast 間 Guest 評価共有 (= karte、Phase 3 法務ゲート defer 中)。

**Reference:** rx-sns.jp (メンエス専門、design / IA reference のみ。ドメインモデル別物)。

**Roles:** Cast (従事者、所属店舗は属性) / Guest (客)。3 ロール化はしない (店舗は属性扱い)。

**Current state (2026-06-18 終了時点):**

- **Phase 0 token 基盤** ✅ / **Phase 1a component vocabulary** ✅ / **Phase 1b-A app shell** ✅
- **Phase 1b-B desktop 3-col layout** ⏸ 未着手 (capture 揃ってる、design 追加不要)
- **Phase 2 各ページ刷新** 🔄 進行中 (rx-sns parity polish per page)
- **Phase 3 karte** ⛔ 法務 hard gate
- **Domain slices**: identity / profile / media / post / feed / social / discovery / bookmarks / notifications / messaging / footprints 全 ✅ / trust 凍結中
- **frontend lint baseline**: **0 error / 1 warning** (post-card.tsx 内 `<img>` → `next/image` 変換のみ残)
- **monolith Dockerfile**: bundle frozen install 有効、Ruby 4.0.3 + grpc/grpc-tools 1.81.1 + google-protobuf 4.35.1
- **proto codegen**: repo-root `./bin/codegen` で Ruby + TS 両方 regen、stub churn 構造的に解消済

## 2. Roadmap Status

| Phase | スコープ | 状態 | 主成果物 |
|---|---|---|---|
| **0** | token foundation (color / typography) | ✅ | #645 (squash bd67c616), `docs/superpowers/specs/2026-05-29-design-system-design.md` |
| **1a** | component vocabulary (7 components: Button/Input/Tab/Toggle/Avatar/UserCard/PostCard) | ✅ | `src/components/ui/`, `/dev/ui` mock |
| **1b-A** | mobile app shell (TopBar + BottomTab + Drawer + FAB) | ✅ | #698 spec / #699 impl |
| **1b-B** | desktop 3-col layout (left nav + center feed + right おすすめユーザー) | ⏸ **未着手** | capture: `.superpowers/rx-sns-render/cast-{search,oshi,bookmarks,settings,ranking}.png` |
| **2** | per-page rebuilds (rx-sns parity polish) | 🔄 部分着地 | 監査 rev2 で大半着地、残 P2 (`#101`, `#102`) |
| **3** | karte (cast→guest private 記録 / Cast 間共有) | ⛔ 法務 hard gate | 設計確定前に弁護士レビュー必須 |

### Domain Slices (monolith + frontend)

| Slice | 状態 | 直近 PR |
|---|---|---|
| identity | ✅ | #649 |
| profile (P1-P5 統合済) | ✅ | #651 series |
| media | ✅ | (Post 周りで使用) |
| post | ✅ | #696, #703-706, #735, #741 |
| feed | ✅ | #722 fix |
| social (block + follow 対称化済) | ✅ | #676-686, #731 |
| discovery (search + ranking) | ✅ | #707-709, #734 |
| bookmarks | ✅ | #700-702 |
| notifications (preferences + gating + deep-link 込み) | ✅ | #691-696, #738-741 |
| messaging (streaming infra 込み) | ✅ | #710-714 |
| footprints (visitor opt-out 込み) | ✅ | #727-730, #742 |
| trust (旧 review/tagging) | 🧊 凍結 | 法務ゲート defer、production 稼働中 |

## 3. Architectural Decisions (キー)

### Stack
- **monolith**: Hanami 2.3 / ROM-SQL (Sequel) / PostgreSQL (schema-per-domain) / Gruf gRPC (port 9001) / RSpec
- **frontend**: Next.js 16 (App Router) / connect-es / SWR + useSWRInfinite / Zustand (authStore) / Tailwind v4
- **proto**: buf 1.69 / grpc-tools 1.81.1 / @bufbuild/protoc-gen-es 2.12
- **Ruby**: 4.0.3 (Docker), 3.4.5 (local)

### Cross-cutting conventions
- **Ubiquitous language**: portfolio→profile / trust→karte / relationship→social / offer 削除。**Cast/Guest** で統一 (旧称セラピストは rx-sns 固有)
- **Identifiers**: account_id (UUID v7) を全 slice の primary referent。proto 新 RPC では `target_account_id` 命名 (古い `target_id` / `user_id` も残る)
- **Relation alias collision (N1 lesson)**: slice 名と被らない複数形 suffix。例: `:visit_records`, `:read_state_records`, `:preference_records`. `:notifications` のような被りは ROM-SQL instrumentation で爆発する
- **Concerns autoload (S2b/#697 lesson)**: `include Concerns::CursorPagination` ではなく `include ::Concerns::CursorPagination` (絶対パス)
- **bin/grpc registration (S2b lesson)**: 新 handler 追加時に `bin/grpc` の require_relative + proto require の **両方** 追加必須。Hanami container 解決と Gruf server registration は別 layer
- **commit / PR**: 必ず `-s` signoff、`Co-Authored-By` は禁止、commit メッセージは英語、PR タイトルは conventional title (semantic-pull-request)、PR は default draft (`gh pr create --draft`)、auto-merge SQUASH + delete-branch
- **codegen**: 編集 → `./bin/codegen` (Ruby + TS 同時) → commit。grpc-tools 1.81.1 pin で churn ゼロ

### Cross-slice (memo)
- **Block check**: `Social::Slice["repositories.block_repository"]`. `bidirectionally_blocked_ids(account_id:)` で双方向 union 取得
- **Visibility filter**: `Social::Slice["use_cases.filter_visible_posts"]` を Post adapter 経由
- **Profile hydration**: `Profile::Slice["use_cases.get_profile"]` (handler 内で呼ぶ)
- **Post hydration (id 配列)**: `Post::Slice["use_cases.posts.list_posts_by_ids"]` (内部に Social::FilterVisiblePosts 包含)
- **Notification preferences gating (#739 で実施)**: `Notifications::UseCases::Emit` が recipient の preferences を読んで per-type skip。`Footprints::UseCases::RecordVisit` (#742) が visitor の preferences を読んで `footprints_record_my_visits=false` で skip

## 4. This Session's Deliverables (#718-#746, 計 25 PR)

### Tier 3 profile content tabs (4)
| PR | スコープ |
|---|---|
| #718 | spec |
| #719 | P1 monolith (ListPostsByAuthor + ListCommentsByAuthor + ListLikedPostsByAccount + media_only) |
| #720 | P2 frontend data (3 hooks + 3 BFFs) |
| #721 | P3 frontend UI (`<Tabs>` 投稿/返信/メディア/いいね + ReplyWithParentRow) |

### rx-sns visual gap audit rev2 + fix (5)
| PR | スコープ |
|---|---|
| #722 | Home feed `PostPresenter` NameError fix |
| #723 | `/profile` own 自分プロフィールに tabs 移植 |
| #724 | "dystopia.city" placeholder text 撤去 + "全員" → "全国" |
| #725 | Home 推し row (フォロー中 horizontal scroll) |
| #726 | TopBar bell + unread badge |

### Footprints (足跡) F0-F3 (4)
| PR | スコープ |
|---|---|
| #727 | F0 spec (`docs/superpowers/specs/2026-06-18-footprints-design.md`) |
| #728 | F1 monolith (proto + slice + repo + 4 use_cases + handler) — 14 spec pass |
| #729 | F2 frontend data (4 hooks + 4 BFFs + footprintsClient) |
| #730 | F3 frontend UI (`/footprints` page + visit trigger + drawer badge) |

### Cleanup audit + spec fixes (4)
| PR | スコープ |
|---|---|
| #731 | `Social::BlockRepository#block` runtime bug fix (`rom.gateways[:default]` undefined → bare `transaction`) |
| #732 | FE dead chain (`src/modules/portfolio/`, 22 BFFs, 3 grpc clients) -2828 LOC |
| #733 | BE dead chain (`slices/profile/grpc/{cast,guest}_handler`, `slices/offer/` 全、`portfolio.v1`/`offer.v1` proto + stubs) -3500+ LOC |
| #737 | `cast_repository_spec` schedule fixture id 明示 (4 pre-existing failures 清算) |

### Deferred 清算 (前半 3)
| PR | スコープ |
|---|---|
| #734 | Search role chips (全て / キャスト / ゲスト) — proto + use_case + UI |
| #735 | Comment reply composer (parent_id 付き) |
| #736 | Notifications target navigation (LIKE / FOLLOW_*) |

### Notifications preferences feature (3)
| PR | スコープ |
|---|---|
| #738 | Persistence: 11 toggle (push_enabled + 9 type + footprint_unread_badge) + RPC + Settings tab |
| #739 | Gating: Emit + Drawer footprint badge を preferences 読みでゲート |
| #740 | Mark all as read RPC + 通知 page ボタン |

### Autonomous backlog 清算 (3)
| PR | スコープ |
|---|---|
| #741 | COMMENT/REPLY notification deep-link (target_post_id 追加) |
| #742 | Footprints visitor opt-out (preferences 12 列目 + RecordVisit guard) |
| #743 | Codegen infra (grpc-tools 1.76.0 pin + repo-root `bin/codegen` wrapper) |

### Dev infra (1) + lint baseline (2)
| PR | スコープ |
|---|---|
| #744 | Dockerfile bundle frozen install + Ruby 4 対応 deps bump (grpc/grpc-tools/google-protobuf を 1.81.1/4.35.1 に) |
| #745 | 未使用 `useHydrated/useOnHydrated` 撤去 (1e/5w → 0e/4w) |
| #746 | 残 3 warning 修正 (apple-icon alt / usePaginatedFetch deps / useMediaUpload deps) — 0e/1w |

## 5. Active Backlog

### A. Autonomous-friendly (design 判断不要、すぐ着手可)

| 項目 | スコープ | 推定 | Why |
|---|---|---|---|
| post-card.tsx `<img>` → `next/image` | sizing 戦略 (width/height vs fill) + `next.config.js` の `remotePatterns` 設定 | 1 PR small | 残 lint warning 1 件、これで baseline 0e/0w |
| Phase 1b-B desktop 3-col layout | rx-sns desktop capture 同等の 3 column (左 nav text labels + 中央 feed + 右 おすすめユーザー pane) を `md:` breakpoint 以上で適用 | 2-3 PR medium | capture 揃ってる (`.superpowers/rx-sns-render/cast-{search,oshi,settings,ranking,bookmarks}.png`)、新規 design 不要 |
| Footprints 訪問回数 column | `footprints.visits.visit_count` 追加 + upsert で increment + UI で badge 表示 | 1 PR small | F0 spec Non-Goals に書いた item の 1 つ。雛形は `notifications.notifications.actor_count` 同型 |
| Notifications spec backfill | #738-#741 で実装した preferences feature を `docs/superpowers/specs/2026-06-18-notification-preferences-design.md` に backfill | 1 PR small | spec が無いまま実装した debt |

### B. Design / 戦略判断が要る

| 項目 | 必要なもの | Memo |
|---|---|---|
| **#101 Settings 外観 tab** (theme switcher) | light mode 色トークン設計 + ThemeProvider + localStorage 永続化 | rx-sns capture: `.superpowers/rx-sns-render/p04-settings-外観.png` (3 radio: ライト/ダーク/システム)。token は `src/app/globals.css` の `--color-*` を CSS variable で出し分け |
| **#102 Top header brand mark** | brand logo asset (現状 `dystopia.city` 文字撤去後の center が空) | rx-sns の R-mark 相当。design 判断要 |
| Messaging media attach | spec (proto + storage 設計 + UI) | M-spec deferred item |
| Messaging reactions / quote-reply / edit-delete | spec | M-spec deferred |
| Push provider 接続 (FCM/APNS) | infra 判断 (Firebase か, native のみか, web push か) | preferences `push_enabled` は currently UI のみ、実 push なし |
| **Phase 3 karte** 設計 | **法務 hard gate**: 個人情報保護 / 名誉毀損 / 風営法 / 売春防止法 周りで弁護士レビュー必須 | memory: `project_redesign_2026_05.md` 法務フレーム参照 |
| Cast 本人確認 (年齢 / 身分) | 別 spec + 法務 hard gate | 未成年登録 = 児童福祉法等の重大犯罪リスク。自己申告では弱い |

### C. Tech debt (低優先)

| 項目 | Memo |
|---|---|
| `slices/profile/repositories/cast_repository.rb` の `is_online?` / `online_cast_ids` / `list_casts_with_filters status:online` | offer slice 削除後も `offer__schedules` テーブルへ書き込んでる。schedules relation の read-only コメントと矛盾。本質的にはこの機能を消すか、新しい shift schedule slice を建てるか |
| `portfolio.profiles` 旧 DB schema | profile P3-P4 で論理的に `profiles` に統合済だが、物理テーブルは `portfolio.profiles` 名で残る (rename = 高コスト migration deferred)。実害なしだが命名汚染 |
| protoc-gen-es version pin | `@bufbuild/protoc-gen-es: ^2.12.0` の caret なので minor bump で TS stub に churn 出る可能性。grpc-tools と同様 exact pin が望ましい |

## 6. Quick-Start for Next Session

### Orientation (5 分以内)

1. **このファイル** を読む
2. **memory** を読む (`/Users/takanokenichi/.claude/projects/-Users-takanokenichi-GitHub-panicboat-monorepo/memory/MEMORY.md`)
3. `git log --oneline -20 origin/main` で直近変更確認
4. `gh pr list --limit 5` で他者 PR 確認 (release-please 等)

### 開発フローの再現

```bash
# 1. 作業ブランチ作成 (worktree 必須)
git worktree add -b <branch> .claude/worktrees/<dir> origin/main

# 2. 編集 → verify
cd .claude/worktrees/<dir>/services/{monolith,frontend}/workspace
# monolith
env -u NODE_OPTIONS bundle exec rspec spec/slices/<slice>
# frontend
env -u NODE_OPTIONS pnpm install
env -u NODE_OPTIONS ./node_modules/.bin/tsc --noEmit
env -u NODE_OPTIONS pnpm build
env -u NODE_OPTIONS pnpm lint  # 期待 baseline: 0 errors / 1 warning

# 3. proto 変更時は stub regen
cd <repo-root> && ./bin/codegen

# 4. commit + push + draft PR + auto-merge
git commit -s -m "feat(slice): conventional title"  # NO Co-Authored-By
git push -u origin HEAD
gh pr create --draft --title "..." --body "..."
gh pr ready <num>
gh pr merge <num> --squash --delete-branch --auto

# 5. 次タスクへ進む (auto-merge no wait、memory `feedback_auto_merge_no_wait.md` 参照)
```

### Local e2e 確認手順 (実画面で動作確認したい時)

詳細: memory `reference_local_e2e_run.md`

```bash
# Postgres は localhost:5432 で homebrew 既起動前提

# monolith gRPC :9001
cd services/monolith/workspace
export DATABASE_URL=postgres://postgres:password@localhost:5432/monolith
export JWT_PRIVATE_KEY="$(openssl genrsa 2048)"
export JWT_PUBLIC_KEY="$(printf '%s' "$JWT_PRIVATE_KEY" | openssl rsa -pubout)"
export HANAMI_ENV=production
env -u NODE_OPTIONS bundle exec ruby bin/grpc

# frontend :3000 (別 shell)
cd services/frontend/workspace
env -u NODE_OPTIONS pnpm dev

# シードアカウント (memory `reference_local_e2e_run.md`):
#   cast=09011111111 / guest=08011111111 / pass=0000
# ログインは BFF を直接叩く + authStore (localStorage `frontend-auth`) を devtools で注入
```

### rx-sns capture 取得手順

詳細: memory `reference_rx_sns_jp.md`

- 既存 24+ PNG: `.superpowers/rx-sns-render/` (gitignored)
- 新規 capture: `.superpowers/rx-sns-render/{capture,explore,mobile-drawer}.js` (puppeteer-core)
- 認証: `.superpowers/.env` (CAST_USER / GUEST_USER 等、gitignored)
- 安全制約: read-only navigation のみ、投稿/いいね/フォロー/他ユーザー訪問は禁止

## 7. Open Questions / 決定待ち

次セッションで決めるべき事項。

### 即決事項 (autonomous で進めて欲しいか確認)

- [ ] Phase 1b-B desktop 3-col 着手するか (推奨: yes、capture ベースなので design 追加不要)
- [ ] post-card.tsx `next/image` 変換 (推奨: yes 但し sizing 戦略 (fill vs explicit) 要簡易判断)
- [ ] Notifications spec backfill (推奨: yes、後者 PR の参照源として)
- [ ] Footprints 訪問回数 column 追加 (推奨: no、F0 spec Non-Goals なので明示的に out of scope)

### 戦略判断

- [ ] **Settings 外観 tab** ライトモード色トークンを設計するか (本格 design effort 〜 1 週間)
- [ ] **Top header brand mark** のロゴをどうするか (design or 借用)
- [ ] **Push provider** の選定 (FCM / APNS / Web Push どれを使うか)
- [ ] **Messaging media attach** スコープ (画像のみ / 動画も / 既存 media slice 活用か新規か)
- [ ] **Cast 本人確認** いつ法務レビューに入るか
- [ ] **Phase 3 karte** いつ法務レビューに入るか (Cast 本人確認と一緒か別か)

## 8. Reference: Memory Files (persistent across sessions)

このセッションで保存 / 更新した memory:

- `feedback_auto_merge_no_wait.md` — gh pr merge --auto 後に待つな
- `feedback_bundle_freeze_check.md` — Gemfile 触ったら bundle install --frozen で締めろ
- (既存) `feedback_reference_grounding.md`, `feedback_verify_claims_against_code.md`, `feedback_destroy_and_recreate.md`, `feedback_create_draft_prs.md`, `feedback_verify_by_running_tests.md`
- (既存) `project_redesign_2026_05.md` — 製品コンセプト、ロール、収益化、法務フレーム
- (既存) `project_pnpm_lint_broken.md` — ESLint 9 + typescript-eslint 互換性事情 (本セッション中も継続して関連)
- (既存) `reference_rx_sns_jp.md` — rx-sns capture 手順 + 安全制約
- (既存) `reference_local_e2e_run.md` — monolith + frontend local 起動手順

## 9. PR Conventions Cheatsheet

```
# Title (conventional commits、semantic-pull-request gate あり)
feat(scope): short imperative description
fix(scope): ...
chore(scope): ...
docs(scope): ...
refactor(scope): ...
test(scope): ...

# Body templates (近時 PR 参照: #728, #738, #741 等)

# Commit message
- Always `-s` signoff
- NO Co-Authored-By trailer ever
- English only

# Branch naming
feat/<slug>
fix/<slug>
chore/<slug>
docs/<slug>

# Worktree path
.claude/worktrees/<branch-name-with-dashes-instead-of-slashes>/
```

## 10. 最終 State Verification

このドキュメントが正しいかを確認する 1 分テスト:

```bash
git log --oneline -5
# 期待: 87c37fd3 (#746) chore(frontend): fix 3 lint warnings ...

cd services/frontend/workspace && env -u NODE_OPTIONS pnpm lint 2>&1 | tail -3
# 期待: ✖ 1 problem (0 errors, 1 warning)

cd services/monolith/workspace && env -u NODE_OPTIONS bundle install --frozen 2>&1 | tail -1
# 期待: Bundle complete!

# bin/codegen が repo-root にある
ls bin/codegen
# 期待: bin/codegen
```

全部期待通りなら、このドキュメントは valid。
