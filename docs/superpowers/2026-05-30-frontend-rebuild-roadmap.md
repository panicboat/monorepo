# Frontend Rebuild Roadmap

Date: 2026-05-30
Status: Program roadmap
Scope: rx-sns 由来デザインへの frontend フル再構築の全体工程。各フェーズは個別 spec / plan に展開する。

## Why this document

design system spec（`specs/2026-05-29-design-system-design.md`）はデザイン言語（token / layout / nav / component / role model / カルテ placement）を定義するが、**現行コードからの移行工程**は定義しない。フル再構築は単一 PR では収まらず、依存とゲートを持つ複数フェーズになるため、その全体像と順序・前提を 1 箇所に固定する。

## Decision context

- ゴールは **フル再構築**（既存ライト/role ベースの画面を最終的に置き換える）。再テーマではない。
- 移行は **clean-slate**：token は新システムだけを残し旧 token を削除する。詳細は `specs/2026-05-30-token-migration-strategy-design.md`。
- 各フェーズ完了後もアプリは `pnpm build` が通る（移行中は旧画面の見た目が崩れるのは許容）。フェーズ単位で独立 PR にできる。

## Phases

```
Phase 0  Token foundation ......... 今ここ
   │
Phase 1  App shell + 共通コンポーネント
   │
Phase 2  Page rebuilds
   │
Phase 3  カルテ機能（評価共有 SNS）
```

### Phase 0 — Token foundation

- 対象: `globals.css` / `layout.tsx`、`config/theme.ts` の削除。
- 内容: spec §3 の token（neutral / brand / functional / semantic / radius / gradient / glow）を hex で `@theme inline` に統一、Noto Sans JP 導入、root font-size 15px 化、旧 token 一掃。
- spec: 既存 §3（hex 修正済）。plan: `plans/2026-05-30-plan-a-design-tokens-foundation.md`。
- 前提: なし。build green を維持。
- サイズ: 小（1 plan）。

### Phase 1 — App shell + shared components

- 対象: `(cast)` / `(guest)` ルートグループ分離の解消 → 共通 shell + 機能トグル（spec §7 / §9）。
- 内容: desktop 3 カラム / mobile bottom-tab + FAB + drawer（spec §4-5）、CTA / input / tab / toggle / user card / post card / avatar の共通コンポーネント（spec §6）を新 token で構築。
- spec: §4-6 が設計を定義。ルート再編と role トグル機構は plan で具体化（必要なら小 spec）。
- 前提: Phase 0。
- サイズ: 大。

### Phase 2 — Page rebuilds

- 対象: feed (`/`) / 認証 (`/login`, `/register`) / `/search` / `/bookmarks` / `/ranking` / `/settings` / プロフィール (`/u/<handle>`) / 投稿詳細 (`/posts/<id>`)。
- 内容: 各ページを新 shell 上に再構築。
- 前提: Phase 1 ＋ **新コンセプト（風俗業界 SNS）の domain / feature spec**。spec §9 は module 構成（feed / identity / media / portfolio / post / relationship / trust）に踏み込まないため、どの module が必要かを決める brainstorm が未実施。
- サイズ: 最大。

### Phase 3 — カルテ機能（評価共有 SNS）

- 対象: Cast nav への「カルテ」追加、paywall ロック表示、レコード一覧 / 検索 / 詳細 / 記入フォーム（spec §8）。
- 内容: 本プロダクトの差別化・収益化要素。net-new。
- 前提: Phase 1 ＋ **専用 domain / 課金 spec（未作成）** ＋ **弁護士確認（spec §8 法務フラグ、実装の hard gate）**。
- サイズ: 大。

## Cross-cutting (spec §10 deferred)

- **error / warning / info の正式 semantic color**: 未確定。Phase 0 では暗色仮値（TODO）で先行し、確定後に token を差し替える。これらを使う画面は仮値前提。
- **サービスカテゴリ（デリヘル / ソープ / 個人）の domain model**: 別 spec。Phase 2 の前提になり得る。
- **キャスト年齢 / 本人確認**: 自己申告では不十分（spec §8）。セキュリティ重大事項として別途検討。

## Gates

- Phase 2 は domain / feature spec の brainstorm を経るまで実装着手しない。
- Phase 3 は弁護士確認が完了するまで実装着手しない。
