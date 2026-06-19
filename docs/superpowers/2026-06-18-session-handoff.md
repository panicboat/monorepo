# Session Handoff: 2026-06-18

> **Purpose:** Single source of truth for a future session to pick up this project without losing context. Start here.

## 1. Executive Summary

**Product:** 風俗業界全般 (デリヘル / ソープ / 個人活動 など 24 業種) のための SNS プラットフォーム。SNS feed primary、収益化要 = Cast 間 Guest 評価共有 (= karte、Phase 3 法務ゲート defer 中)。

**Reference:** rx-sns.jp (メンエス専門、design / IA reference のみ。ドメインモデル別物)。

**Roles:** Cast (従事者、所属店舗は属性) / Guest (客)。3 ロール化はしない (店舗は属性扱い)。

**Current state (2026-06-19 進行中):**

- **Phase 0 token 基盤** ✅ / **Phase 1a component vocabulary** ✅ / **Phase 1b-A app shell** ✅
- **Phase 1b-B desktop 3-col layout** ✅ (PR1 #752 = 左 nav sidebar + 中央 feed、PR2 = 右「おすすめユーザー」pane = SuggestUsers RPC)
- **Phase 2 各ページ刷新** 🔄 進行中 (rx-sns parity polish per page)
- **Phase 3 karte** ⛔ 法務 hard gate
- **Domain slices**: identity / profile / media / post / feed / social / discovery / bookmarks / notifications / messaging / footprints 全 ✅ / trust 凍結中
- **frontend lint baseline**: **0 error / 0 warning** (#750 で post-card.tsx `<img>` → `next/image` 完了)
- **monolith Dockerfile**: bundle frozen install 有効、Ruby 4.0.3 + grpc/grpc-tools 1.81.1 + google-protobuf 4.35.1
- **proto codegen**: repo-root `./bin/codegen` で Ruby + TS 両方 regen、stub churn 構造的に解消済

## 2. Roadmap Status

| Phase | スコープ | 状態 | 主成果物 |
|---|---|---|---|
| **0** | token foundation (color / typography) | ✅ | #645 (squash bd67c616), `docs/superpowers/specs/2026-05-29-design-system-design.md` |
| **1a** | component vocabulary (7 components: Button/Input/Tab/Toggle/Avatar/UserCard/PostCard) | ✅ | `src/components/ui/`, `/dev/ui` mock |
| **1b-A** | mobile app shell (TopBar + BottomTab + Drawer + FAB) | ✅ | #698 spec / #699 impl |
| **1b-B** | desktop 3-col layout (left nav + center feed + right おすすめユーザー) | ✅ | PR1 #752 = `SideNav` 左 nav + 中央 feed (AppShell 3-col 化、TopBar `md:hidden`)。PR2 = 右「おすすめユーザー」pane (discovery `SuggestUsers` RPC = 反対ロール新着順 + `SuggestedUsersPane` を `xl:` 配置) |
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

## 4. This Session's Deliverables

### Session 2026-06-19 (継続、autonomous backlog 消化)

handoff doc Section 5 A の backlog を A 路線で消化中。

| PR | スコープ | 状態 |
|---|---|---|
| #750 | post-card.tsx `<img>` → `next/image` (fill + `NEXT_PUBLIC_MEDIA_URL` 由来 remotePatterns)。lint baseline **0e/0w** 達成 | merged |
| #751 | Notifications preferences spec backfill (`docs/superpowers/specs/2026-06-18-notification-preferences-design.md`) | merged |
| #752 | Phase 1b-B PR1: `SideNav` desktop 左 nav + AppShell 3-col 化 (TopBar `md:hidden`) | merged |
| #753 | Phase 1b-B PR2: discovery `SuggestUsers` RPC (反対ロール新着順、自分/フォロー中/双方向 block 除外) + `useSuggestedUsers` hook + BFF + `SuggestedUsersPane` を AppShell 右カラム (`xl:`) に配置。spec `2026-06-19-suggested-users-design.md` / plan `2026-06-19-suggested-users.md` | merged |
| (本 PR) | Footprints 訪問回数: `footprints.visits.visit_count` 列追加 + `upsert_visit` で increment + `Footprint.visit_count` proto + `/footprints` UI で「N回訪問」表示 | 進行中 |

**残 backlog (Section 5 A)**: なし。autonomous-friendly backlog 全消化。次は Section 12.3 大方針決定 (ステークホルダー判断) or B/C の design・tech debt 項目。

### Session 2026-06-18 Deliverables (#718-#746, 計 25 PR)

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
| ~~post-card.tsx `<img>` → `next/image`~~ | ✅ **#750 完了** (fill + `NEXT_PUBLIC_MEDIA_URL` 由来 remotePatterns)。lint baseline 0e/0w | — | — |
| ~~Phase 1b-B desktop 3-col layout~~ | ✅ **完了** (PR1 #752 = `SideNav` 左 nav + 中央 feed、PR2 #753 = discovery `SuggestUsers` RPC 反対ロール新着順 + `SuggestedUsersPane` を `xl:` 配置) | — | — |
| ~~Footprints 訪問回数 column~~ | ✅ **完了** (本 PR、`footprints.visits.visit_count` + upsert increment + `Footprint.visit_count` proto + `/footprints` で「N回訪問」表示)。F0 spec Non-Goals だったが回収 | — | — |
| ~~Notifications spec backfill~~ | ✅ **#751 完了** (`docs/superpowers/specs/2026-06-18-notification-preferences-design.md`) | — | — |

### B. Design / 戦略判断が要る

| 項目 | 必要なもの | Memo |
|---|---|---|
| ~~**#101 Settings 外観 tab** (theme switcher)~~ | ✅ **完了** (本 PR) | 自前テーマ基盤（no-flash inline script + `ThemeProvider`/`useTheme`、依存なし。next-themes は ~13ヶ月 dormant、@wrksz/themes は若く単独メンテナで不採用）。`[data-theme="light"]` で semantic alias 上書き、外観 tab (ライト/ダーク/システム)。spec `2026-06-19-theme-switcher-design.md` / plan `2026-06-19-theme-switcher.md` |
| ~~**#102 Top header brand mark**~~ | ✅ **完了** (本 PR) | サービス名 = **dystopia.city** で確定。`BrandMark` (brand-gradient wordmark) を SideNav 上部 + mobile TopBar center に配置。本ロゴ確定時は `BrandMark` 差し替えで対応 |
| Messaging media attach | spec (proto + storage 設計 + UI) | M-spec deferred item |
| Messaging reactions / quote-reply / edit-delete | spec | M-spec deferred |
| Push provider 接続 (FCM/APNS) | infra 判断 (Firebase か, native のみか, web push か) | preferences `push_enabled` は currently UI のみ、実 push なし |
| **Phase 3 karte** 設計 | **法務 hard gate**: 個人情報保護 / 名誉毀損 / 風営法 / 売春防止法 周りで弁護士レビュー必須 | memory: `project_redesign_2026_05.md` 法務フレーム参照 |
| Cast 本人確認 (年齢 / 身分) | 別 spec + 法務 hard gate | 未成年登録 = 児童福祉法等の重大犯罪リスク。自己申告では弱い |

### C. Tech debt (低優先)

| 項目 | Memo |
|---|---|
| ~~`cast_repository.rb` の `is_online?` / `online_cast_ids` / `list_casts_with_filters`~~ | ✅ **完了** (本 PR)。裏取りの結果 writer も caller も無い完全な dead code だった (「書き込んでる」は不正確)。4 メソッド + `schedules` relation 削除 + `offer.schedules` テーブル drop migration。`offer.plans` は別 concern で残置 |
| `portfolio.profiles` 旧 DB schema | profile P3-P4 で論理的に `profiles` に統合済だが、物理テーブルは `portfolio.profiles` 名で残る (rename = 高コスト migration deferred)。実害なしだが命名汚染 |
| ~~protoc-gen-es version pin~~ | ✅ **#755 完了** (caret → exact `2.12.0` pin。`@bufbuild/buf`/grpc-tools と同方針) |

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

---

## 11. Release Readiness (重要)

**本ドキュメント Section 2-7 を全消化しても production release はできない。** 上記は **engineering scope** であり、release には **法務 / 運用 / プロダクト / 商業** の 4 軸が別途必要。本セクションでそれを明示する。

### 11.1 法務 (Legal — hard gate)

風俗業界 SNS は法務リスクが他業種比 1 桁多い。**弁護士レビュー必須**、design 確定前にやる。

| 項目 | 状態 | Impact |
|---|---|---|
| **Cast 本人確認 (年齢/身分)** | ❌ 未実装 | 未成年登録 = 児童福祉法/出会い系規制法等の重大犯罪。自己申告では弱い。eKYC (運転免許/マイナンバー写真) 等が標準 |
| **Guest 年齢確認** | ❌ 未実装 | 利用規約ベース自己申告で進める方針 (memory 既決) だが、明示的 UI flow が要 |
| **Privacy Policy / Terms of Service / 18+ confirmation** | ❌ 未作成 | 法務作成 + UI 統合。風営法 / 売春防止法 / 個人情報保護法 / 名誉毀損 すべて触れる |
| **karte (Phase 3) 設計確定前のレビュー** | ⛔ defer 中 | 要配慮個人情報 (性生活) に該当しうる + 名誉毀損リスク。memory `project_redesign_2026_05.md` 法務フレーム参照 |
| **コンテンツモデレーション (報告 / abuse flow / ban)** | ❌ 未実装 | 違法投稿 / 児童ポルノ / 売春斡旋等の検知と対応。本人通報 + 自動検出 + 運用者操作の三段構え |
| **データ削除要求対応 (個人情報保護法 + GDPR 風)** | ❌ 未実装 | account deletion flow / データエクスポート / 削除証跡 |
| **特商法 / 資金決済法表記** | ❌ 商業 dimension 整理後 | 投げ銭 / サブスク導入時は必須 |
| **広告審査 (Google/Apple/SNS 広告 NG 業種)** | ⚠ ドメイン特性 | 広告チャンネル制限あり。集客戦略への影響 |

**Action**: release 1-2 ヶ月前に法務専任を入れる前提でスケジュール組む。本セッション ROADMAP には含めず別 track。

### 11.2 運用 (Operations)

| 項目 | 状態 | 必要 |
|---|---|---|
| **本番 deploy pipeline** | ⚠ 一応動く | Deploy Container は GitHub Actions で稼働、但し **production target account / cluster / domain 未確定** |
| **DNS / SSL / CDN** | ❌ 未調達 | サービスドメイン取得、Cloudflare 等の CDN、TLS 証明書 |
| **本番 DB** | ❌ 未調達 | RDS / Cloud SQL / etc。シード / マイグレーション戦略、bk |
| **監視 (metrics / logs / traces)** | ⚠ OpenTelemetry SDK 入ってる | exporter 接続先未設定 (Datadog / Grafana / NewRelic 等) |
| **アラート** | ❌ 未設定 | error rate / latency / queue / DB connection saturation 等 |
| **runbook / incident response** | ❌ 未作成 | on-call ローテ、escalation、事故対応 |
| **rate limiting / abuse防御** | ❌ 未実装 | API rate limit / login brute force 防御 / DDoS 対策 |
| **secrets management** | ⚠ JWT key 自前生成 | KMS / Vault 等で本番 key rotation 設計 |
| **backup / DR** | ❌ 未設計 | DB backup、リカバリ手順、RTO/RPO 定義 |
| **scaling 設計** | ❌ 未試算 | 初期 DAU 想定 → 必要 instance 数、PG Listen/Notify は connection-per-viewer なので Redis 移行検討余地 (memory `messaging slice` の Concerns 参照) |
| **GDPR / 個人情報保護法 体制** | ❌ 未整備 | データ処理同意、cross-border transfer、保管期間ポリシー |

### 11.3 プロダクト (Product UX 完成度)

| 項目 | 状態 | Memo |
|---|---|---|
| **Login / Signup UI** | ❌ 解体済 | memory: "login UI は解体済で存在しない"。authStore 直注入経由でしか動かない (dev only) |
| **Onboarding flow** | ❌ 未設計 | Cast: 業種選択 + プロフィール作成 + 年齢確認 / Guest: 簡易確認 + プロフィール |
| **Password reset / SMS verification 本番化** | ❌ モック "0000" のまま | SMS provider (Twilio 等) 選定 + 本番接続 |
| **Push notification 接続** | ❌ toggle のみ | FCM / APNS / Web Push 選定 + service worker (Web) or native 実装 |
| **Brand mark / Logo** | ❌ design 未定 | Top header center 空 (#102) |
| **Theme switcher (light mode)** | ❌ design 未定 | #101 |
| **Desktop 3-col layout** | ❌ 未実装 | Phase 1b-B、capture はある |
| **画像最適化 (next/image)** | ⚠ 一部 `<img>` 残 | post-card.tsx、ユーザー画像の sizing 戦略 + remotePatterns 設定 |
| **Empty / error / loading 状態の質** | ⚠ 機能ベース | UX writer のレビューが居ない |
| **Accessibility (WCAG)** | ⚠ baseline | jsx-a11y rules 通してるが、scrren reader 検証 / keyboard nav / contrast 監査 未実施 |
| **i18n / l10n** | ❌ 日本語 hardcoded | release は日本のみ前提で 当面 OK だが、コードはハードコード散在 |
| **error tracking (Sentry 等)** | ❌ 未接続 | frontend / backend 両方 |
| **analytics (GA4 / Mixpanel 等)** | ❌ 未接続 | KPI 計測 |

### 11.4 商業 (Business / Monetization / Distribution)

| 項目 | 状態 | Memo |
|---|---|---|
| **収益化モデル確定** | ⚠ 部分決定 | memory: "Cast 間 Guest 評価共有 = karte" が主収益源、karte 自体 Phase 3 法務 hard gate。投げ銭 / サブスク / 広告 のどれを併用するか未決 |
| **支払い系** | ❌ 未実装 | 商取引次元 drop 済の名残。投げ銭・サブスク導入時は Stripe / SBPS / GMO PG 等 + 特商法対応 |
| **Web vs Native** | ⚠ 既定 Web | PWA で行くか、native app (iOS App Store 風俗系は審査 NG 確率高い、Android 同様) は別軸 |
| **集客 / マーケ** | ❌ 未着手 | 風俗業界向け広告 channel 限定。SNS / Google 広告 NG、業界専門誌 or インフルエンサー |
| **初期 Cast 確保戦略** | ❌ 未着手 | Cold start: Cast 居ないと Guest 来ない、Guest 居ないと Cast 残らない。クローズドベータ + 招待制等 |
| **初期 Guest 確保戦略** | ❌ 未着手 | 既存風俗情報サイトからの誘導? アフィリエイト? |
| **クロスボーダー法務 (海外配信)** | ❌ 未検討 | 日本ドメイン特化なら海外 IP block 等の設計 |
| **コンプライアンス保険 / 弁護士顧問契約** | ❌ 未着手 | 業界特性的に高リスク → 保険 + 顧問必須 |

### 11.5 まとめ: handoff doc 完走 → release への gap

```
[handoff doc 完走 = engineering done]
    ↓ ここから release まで:
        + 法務 8 項目 (1-3 ヶ月 + 弁護士費用)
        + 運用 11 項目 (2-3 ヶ月 + infra 費用)
        + プロダクト 13 項目 (1-2 ヶ月 + design 費用)
        + 商業 8 項目 (継続的、ローンチ前提作業)
```

現実的タイムライン:
- **Closed alpha** (社内動作確認): handoff doc Section 5 A backlog 消化で可。**1-2 週間**
- **Closed beta** (限定 cast 招待): + 法務 6 項目 (本人確認 + privacy/ToS + モデレーション基礎) + 運用 5 項目 (deploy/監視/secrets/backup/rate limit) + プロダクト 5 項目 (login/signup/onboarding/error tracking/push)。**2-3 ヶ月**
- **Open beta / GA**: + 残法務 + 残運用 + 集客戦略 + 弁護士顧問契約。**追加 3-6 ヶ月**

**結論**: handoff doc は engineering ロードマップで、release には別 3 軸 (法務 / 運用+UX / 商業) のロードマップが必要。それぞれ別ドキュメントとして起こすことを推奨。

### 11.6 Next-step recommendation

このセクションを踏まえた次セッション初手:

1. ステークホルダー (法務 / プロダクトオーナー / インフラ) と **release target date** を確認
2. release date から逆算して **法務 review schedule** を真っ先に確保 (lead time 長い)
3. handoff doc Section 5 A (autonomous backlog) は並行進行
4. closed alpha 用 **minimal feature freeze** を定義 (= release MVP 範囲)

---

## 12. Development Approach (合意済)

「各項目で都度議論する」より **「大方針を先決めて autonomous run で消化する」** A 寄り路線を採用する (本人合意済、本セッション内で決定)。

### 12.1 採用理由 (Why A)

1. **法務 lead time が長い** (Cast 本人確認 / karte レビュー = 弁護士込みで 1-3 ヶ月)。都度議論だと release 後ろ倒し → 法務だけ別 track 先行
2. **4 軸並行が必要**。大方針があれば各軸独立進行、都度議論だと並行性消える
3. **autonomous run の効率**。本セッションで 25 PR 実証済。Section 5 A の backlog は議論ゼロで機械消化可

### 12.2 軸別の確度差 (運用上の重み付け)

| 軸 | 大方針先決めの確度 | 運用 |
|---|---|---|
| 法務 | 中 (弁護士の意見で揺れる) | **別 track / 都度判断 OK** |
| 運用 (infra/scaling) | 高 | 大方針で十分 |
| プロダクト MVP 必須 UX (Login/Onboarding/Push 等) | 高 (rx-sns + 国内 SNS 慣習) | 大方針で十分 |
| プロダクト polish (外観 / brand mark) | 低 | デザイン判断は都度 |
| 商業 (収益化 / 集客) | 中 | 戦略判断は都度 |
| Section 5 A autonomous backlog | 完全 A | autonomous run で消化 |

### 12.3 大方針 (master plan) で決めるべき項目

次セッション初手で確定する。これが決まれば autonomous run に移れる。

#### 法務 track
- [ ] 弁護士 (個人情報保護 / IT / 風営法) コンタクト先
- [ ] 顧問契約スケジュール
- [ ] 質問リスト (Cast 本人確認方式 / Privacy Policy 骨子 / karte 法的整理 / モデレーションフロー)

#### release target
- [ ] **Closed alpha** target date (現実: 1-2 週間以内が可能)
- [ ] **Closed beta** target date (現実: 法務 6 項目クリア後、2-3 ヶ月)
- [ ] **Open beta / GA** target date (現実: 追加 3-6 ヶ月)

#### MVP feature freeze (= closed beta release 範囲)
- [ ] Login/Signup UI (再構築要、現状 authStore 直注入 only)
- [ ] Cast 本人確認 (eKYC 等)
- [ ] Guest 18+ 自己申告
- [ ] Privacy Policy / Terms of Service / 18+ confirmation
- [ ] Onboarding flow (Cast / Guest 別)
- [ ] Push provider (FCM / APNS / Web Push どれか or 無し)
- [ ] SMS provider (Twilio 等、現状 "0000" mock)
- [ ] Content moderation 最低限 (報告 + ban)
- [ ] karte は含めるか否か (Phase 3 法務ゲート、含めない決定もあり)
- [ ] Desktop 3-col layout (Phase 1b-B) は含めるか否か

#### 商業
- [ ] 収益化モデル: karte 主軸 / 投げ銭併用 / サブスク / 広告 (NG channel 多) — どれか
- [ ] 支払い provider (Stripe / SBPS / GMO PG)
- [ ] Cold start 戦略 (初期 Cast 確保 + 初期 Guest 確保)
- [ ] Web か native か (App Store / Play Store は風俗系 NG 確率高い → PWA 推奨か)

#### 運用
- [ ] 本番 infra (AWS / GCP / Azure / 国内 vendor)
- [ ] DB (RDS / Cloud SQL / etc)
- [ ] 監視 stack (Datadog / Grafana Cloud / NewRelic 等)
- [ ] Error tracking (Sentry / Bugsnag)
- [ ] Analytics (GA4 / Mixpanel / Amplitude)
- [ ] Secrets management (KMS / Vault)
- [ ] CDN / domain / DNS

### 12.4 大方針確定後の autonomous run シナリオ

```
ステークホルダー方針確定
    ↓
master plan を docs/superpowers/ に commit (本ドキュメントの Section 12 update or 別 doc)
    ↓
私 (AI) が autonomous run:
  - handoff doc Section 5 A の backlog 消化 (Phase 1b-B / Notifications spec / post-card next/image / 訪問回数)
  - MVP 必須 UX の確度高い項目 (Login UI 再構築 / Onboarding / SMS provider / error tracking 接続 等)
  - 運用の確度高い項目 (Sentry / Datadog 接続 / Cloudflare 設定 等)
    ↓
私からのフィードバック / 都度判断項目だけ ユーザーへエスカレ:
  - 法務確認次第のもの
  - design 判断 (theme / brand mark / 細かい UX wording)
  - 商業戦略
    ↓
3 ヶ月ごとに方針 review session
```

### 12.5 落とし穴 (B 寄りで進めた場合のリスク)

参考までに B (都度議論) 路線のリスクを記録しておく。採用しないが選定時の比較材料:

- handoff cost が毎セッション継続発生 (私の context が毎回切れる、過去 25 PR の議論が毎回再演)
- 4 軸の依存関係が見えないまま個別最適に走るリスク
- 法務確定が遅れて全体 release date がずるずる
- ステークホルダー (本人 + 弁護士 + infra 等) との同期コストが累積
- autonomous run の利点が消える

### 12.6 即時 next action

次セッション開始時:

1. **本ドキュメント Section 12.3 のチェックリストを上から潰す** (大方針決定セッション)
2. 確定したものは Section 12.3 のチェックを埋めて commit
3. 確定できなかったものは括弧書きで条件を明記 ("法務 X 確認次第" 等)
4. autonomous run target に切り替え可能になったら、handoff doc Section 5 A から消化開始

